const express = require('express');
const morgan = require('morgan');
const passport = require('passport');
const {Strategy: JWTStrategy, ExtractJwt} = require('passport-jwt');
const OAuth2Strategy = require('passport-oauth2');
const refresh = require('passport-oauth2-refresh');
const {createProxyMiddleware} = require('http-proxy-middleware');
const Redis = require('ioredis');

const production = process.env.NODE_ENV === 'production';

let redisClient = new Redis(process.env.UPSTASH_URL);

// non-client requests will fail this straightaway for invalid token
// valid client will send a bearer token that contains team_id from which
// we lookup the API access token. If the team_id doesn't exist passport
// sends a 401 unauthorized, and the frontend will open a modal and
// request re-authorization
passport.use(new JWTStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.MIRO_SECRET,
  issuer: 'miro'
}, (payload, done) =>{//verify payload
  //try to get access token
  redisClient.get(payload.team, (err, acc) => {
    if(acc){
      return done(err, {acc, team: payload.team});
    } else {//try to get refresh token
      redisClient.get('{refresh}'+payload.team, (err, ref) => {
	if(!ref || !production){
	  // no authorization, redirect this case later
	  return done(null, {team: payload.team});
	} else {//try to use refresh token
	  refresh.requestNewAccessToken(
	    'oauth2', ref, (err, accTok, refTok, result) => {
	      //what happens here on failure to renew? err or null values?
	      if(err) return done(err);
	      //save new token pair to redis
	      redisClient.pipeline()
		.set(result.team_id, accTok,
		     'ex', result.expires_in - 10)
		.set('{refresh}'+result.team_id, refTok,
		     'ex', 60*60*24*60-30 /*60 days*/)
		.exec();
	      return done(err, {acc: accTok, team:result.team_id});
	    });
	} 
      });
    }
  });
}));

//this is a hack to allow extra query params in auth url
OAuth2Strategy.prototype.authorizationParams = function(options){
  return {team_id: options.team_id};
};
    
// The strategy for handling the oauth2 authorization handshake.
// Store the token (pair?) in redis for JWT strategy to use
const MiroStrategy = new OAuth2Strategy(
  { // strategy options from environment
    authorizationURL: process.env.AUTH_URL,
    tokenURL: process.env.TOKEN_URL,
    clientID: process.env.MIRO_ID,
    clientSecret: process.env.MIRO_SECRET,
    callbackURL: process.env.CALLBACK_URL
  }, (acc, ref, params, prof, done) => { // verify
    const pipeline = redisClient.pipeline()
	  .set(params.team_id, acc);
    if(params.expires_in > 0) {
      pipeline.expire(params.team_id, params.expires_in - 10);
    }
    if(ref){
      pipeline.set('{refresh}'+params.team_id, ref,
		   'ex', 60*60*24*60-30 /* 60 days */);
    }
    pipeline.exec()
    done(null, acc);
  });

passport.use(MiroStrategy);
refresh.use(MiroStrategy);

const app = express();

app.use(morgan( production ? 'common' : 'dev'));

//this handles the backend authorization token
//it finishes by redirecting to a page closes modal
//app.use('/auth', passport.authenticate('oauth2', {session: false}));
//call authenticate manually to supply req.query info to hack above
app.use('/auth', (req,res,next) =>{
  passport.authenticate('oauth2',
			{session: false,
			 team_id: req.query.team_id})(req,res,next);
});
app.use('/auth/redirect',
	(req,res,next) => res.redirect('/success.html'));



// secure the api proxy
app.use('/api',
	//block anything without jwt from the frontend client	
	passport.authenticate('jwt', {session: false}),
	//if req is a frontend client
	(req, res, next) => {
	  //and we have an access code, admit
	  if(req.user.acc) return next();
	  //if no access code, 401 with team_id hint
	  else res.set('x-team-id', req.user.team).sendStatus(401);
	});

// proxy image posts to Miro API, replace the
// frontend jwt token with our backend api token
app.post('/api/:id/images',
	 createProxyMiddleware({
	   target:'https://api.miro.com/v2/boards/',
	   changeOrigin: true,
	   pathRewrite: {'^/api': ''},
	   onProxyReq: (proxyReq, req, res) => {
	     console.log('proxy request');
	     proxyReq.setHeader('Authorization',
	      			"Bearer " + req.user.acc);
	   }
	 }));


if(production) {
  // serve the build output in production
  app.use(express.static('dist'));
} else { 
  // proxy the vite server in dev
  app.use(createProxyMiddleware({target:'http://localhost:3000/'}));  
}


//start the server
const server = require('http')
      .createServer(app)
      .listen(
	process.env.PORT || 3001,
	() => console.log(`Backend listening on ${server.address().port}`)
      );
