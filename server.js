const express = require('express');
const cors = require('cors');
const passport = require('passport');
const {Strategy: JWTStrategy, ExtractJwt} = require('passport-jwt');
const OAuth2Strategy = require('passport-oauth2');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();

console.log('app id:', process.env.MIRO_ID);

const teamSchema = new mongoose.Schema({
  team: {type: String, unique:true, required: true},
  access: String
});

const Team = mongoose.model('Team', teamSchema);

// the client will send a bearer token that we extract the team id from
// and lookup the authorization code. If the id doesn't exist passport
// sends a 401 unauthorized, and the frontend will open a modal and
// request re-authorization
passport.use(new JWTStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.MIRO_SECRET,
  issuer: 'miro'
}, async (payload, done) =>{
  let record = await Team.findOne({team: payload.team}, 'team access -_id');
  console.log(record || payload.team);
  done(null, record || false);
}));

// the strategy for handling the oauth2 authorization handshake
// once we have the token, use it to call the miro API and lookup
// the team id. store the pair in the database for JWT strategy to use
passport.use(new OAuth2Strategy(
  { // strategy options
    authorizationURL: process.env.AUTH_URL,
    tokenURL: process.env.TOKEN_URL,
    clientID: process.env.MIRO_ID,
    clientSecret: process.env.MIRO_SECRET,
    callbackURL: process.env.CALLBACK_URL
  }, (acc, ref, prof, done) => { // verify callback
    axios('https://api.miro.com/v1/oauth-token', {
      headers: {Authorization: "Bearer " + acc}
    }).then(async result => {
      console.log(result.data);
      let team = await Team.findOneAndUpdate(
	{team: result.data.team.id},
	{access: acc},
	{new: true, upsert: true, projection: 'team access -_id'}
      );
      done(null, team);
    }).catch(err => {
      done(err, false);
    });
  }));

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
//client will respond to a 401 by trying to reauthorize
app.use(passport.authenticate('jwt', {session: false}));

//check the database for the current user
app.use('/who',(req,res,next) =>{
  res.send(req.user);
});

//test create a sticky via api
app.post('/:id/sticky', (req,res,next)=>{
  axios.post(
    `https://api.miro.com/v2/boards/${req.params.id}/sticky_notes`,
    {data: {content: 'api hello', shape: 'square'}},
    {headers: {Authorization: 'Bearer ' + req.user.access}}
  ).then(result => {
    res.sendStatus(result.status);
  }).catch(err => next(err));
});

app.use((req,res,next) => res.send(`hello world: ${req.user}`));

mongoose.connect(process.env.MONGO_URL, async (err) => {
  if(err) console.log(err);
  //console.log(mongoose.connection.readyState);
  app.listen(3001, () => console.log('backend listening on port 3001'))

});

