const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const passport = require('passport');
const {Strategy: JWTStrategy, ExtractJwt} = require('passport-jwt');
const OAuth2Strategy = require('passport-oauth2');
const axios = require('axios');
const {createProxyMiddleware} = require('http-proxy-middleware');
const Redis = require('ioredis');

let redisClient = new Redis(process.env.UPSTASH_URL);

// the client will send a bearer token that we extract the team id from
// and lookup the authorization code. If the id doesn't exist passport
// sends a 401 unauthorized, and the frontend will open a modal and
// request re-authorization
passport.use(new JWTStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.MIRO_SECRET,
  issuer: 'miro'
}, (payload, done) =>{
  // redisClient.hget(payload.team, "access", (err,result) => {
  //   console.log(result);
  //   done(err, result);
  // });
  redisClient.hget(payload.team, 'access', done);
}));

// The strategy for handling the oauth2 authorization handshake.
// Once we have the token, use it to call the miro API and lookup
// the team id. Store the pair in the database for JWT strategy to use
passport.use(new OAuth2Strategy(
  { // strategy options from environment
    authorizationURL: process.env.AUTH_URL,
    tokenURL: process.env.TOKEN_URL,
    clientID: process.env.MIRO_ID,
    clientSecret: process.env.MIRO_SECRET,
    callbackURL: process.env.CALLBACK_URL
  }, (acc, ref, prof, done) => { // verify
    //query the miro api for token info
    axios('https://api.miro.com/v1/oauth-token', {
      headers: {Authorization: "Bearer " + acc}
    }).then(//place the token into the database and done
      result => {
	redisClient.hmset(result.data.team.id,
			  {access: acc},
			  (err,ok) => {done(err, err?false:acc)});
      },
      done) //axios promise reject (timeout?)
      .catch(done); //axios error (non 2xx codes, etc.)
  }));


const app = express();

app.use(morgan('dev'));

// setup CORS for the front/backend communication
app.use(cors({
  origin: 'http://localhost:3000'
}));


//this handles the backend authorization token
//it finishes by redirecting to a page that double
//checks the user and then closes the modal.
app.use('/auth/redirect',
	passport.authenticate('oauth2', {session: false}),
	(req,res,next) => res.redirect('http://localhost:3000/success.html'));

app.use('/auth', passport.authenticate('oauth2', {session: false}));

//this blocks anything not coming from the frontend client
//client will respond to 401 by trying to reauthorize
//app.use(passport.authenticate('jwt', {session: false}));

// proxy image posts to Miro API, replace the
// frontend jwt token with our backend api token
app.post('/:id/images',
	 passport.authenticate('jwt', {session: false}),
	 createProxyMiddleware({
	   target:'https://api.miro.com/v2/boards/',
	   changeOrigin: true,
	   onProxyReq: (proxyReq, req, res) => {
	     proxyReq.setHeader('Authorization',
	      			"Bearer " + req.user);
	   }
	 }));

// proxy the vite server in dev
if(process.env.NODE_ENV != 'production') {
  console.log('devel');
  app.use(createProxyMiddleware({target:'http://localhost:3000/'}));
} else {
  console.log('production');
  app.use(express.static('dist'));
}


//start the server
const server = require('http')
      .createServer(app)
      .listen(
	process.env.PORT,
	() => console.log(`Backend listening on ${server.address().port}`)
      );
