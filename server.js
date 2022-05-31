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

// the client will send a bearer token that we extract the team id from
// and lookup the authorization code. If the id doesn't exist passport
// sends a 401 unauthorized, and the frontend will open a modal and
// request re-authorization
passport.use(new JWTStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.MIRO_SECRET,
  issuer: 'miro'
}, (payload, done) =>{//verify payload
  //try to get access token
  redisClient.get(payload.team, (err, access) => {
    console.log('get access' + access);
    if(access){
      done(err, access);
    } else {//try to get refresh token
      redisClient.get('{refresh}'+payload.team, (err, ref) => {
	console.log('get refresh' + ref);
	if(!ref){//unauthorized
	  done(null, false);
	} else {//try to use refresh token
	  refresh.requestNewAccessToken(
	    'oauth2', ref, (err, accTok, refTok, result) => {
	      console.log('requestnewaccess');
	      console.log(result);
	      //save new token pair to redis
	      redisClient.pipeline()
		.set(result.team_id, accTok,
		     'ex', result.expires_in - 10)
		.set('{refresh}'+result.team_id, refTok,
		     'ex', 60*60*24*60-30 /*60 days*/)
		.exec();
	      done(err, accTok);
	    });
	} 
      });
    }
  });
}));

    
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
    console.log(params);
    const pipeline = redisClient.pipeline()
	  .set(params.team_id, acc);
    if(params.expires_in > 0) {
      pipeline.expire(params.team_id, params.expires_in - 10);
    }
    if(params.refresh_token){
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
//it finishes by redirecting to a page that double
//checks the user and then closes the modal.
app.use('/auth', passport.authenticate('oauth2', {session: false}));
app.use('/auth/redirect',
	(req,res,next) => res.redirect('/success.html'));



//this blocks anything not coming from the frontend client
//client will respond to 401 by trying to reauthorize
app.use('/api', passport.authenticate('jwt', {session: false}));

// proxy image posts to Miro API, replace the
// frontend jwt token with our backend api token
app.post('/api/:id/images',
	 createProxyMiddleware({
	   target:'https://api.miro.com/v2/boards/',
	   changeOrigin: true,
	   pathRewrite: {'^/api': ''},
	   onProxyReq: (proxyReq, req, res) => {
	     proxyReq.setHeader('Authorization',
	      			"Bearer " + req.user);
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
