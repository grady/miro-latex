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


passport.use(new JWTStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.MIRO_SECRET,
  issuer: 'miro'
}, async (payload, done) =>{
  console.log(payload);
  let record = await Team.findOne({team: payload.team}, 'team access -_id');
  console.log(record);
  done(null, record);
}));

passport.use(new OAuth2Strategy(
  {
    authorizationURL: process.env.AUTH_URL,
    tokenURL: process.env.TOKEN_URL,
    clientID: process.env.MIRO_ID,
    clientSecret: process.env.MIRO_SECRET,
    callbackURL: process.env.CALLBACK_URL
  }, (acc, ref, prof, done) =>{
    axios('https://api.miro.com/v1/oauth-token', {
      headers: {Authorization: "Bearer " + acc}
    }).then(async result => {
      console.log(result.data);
      let team = await Team.findOneAndUpdate(
	{team: result.data.team.id},
	{access: acc},
	{new: true, upsert: true}
      );
      console.log(team);
      done(null, team);
    });
  }));

app.use(cors({
  origin: 'http://localhost:3000'
}));


//this handles the backend authorization token
app.use('/auth/redirect',
	passport.authenticate('oauth2', {session: false}),
	(req,res,next) => res.send('authenticated ' + req.user.team));

app.use('/auth', passport.authenticate('oauth2', {session: false}));

//this blocks anything not coming from the frontend client
app.use(passport.authenticate('jwt', {session: false}));

app.use((req,res,next) => res.send(`hello world: ${req.user}`));

mongoose.connect(process.env.MONGO_URL, async (err) => {
  if(err) console.log(err);
  //console.log(mongoose.connection.readyState);
  app.listen(3001, () => console.log('backend listening on port 3001'))

});

