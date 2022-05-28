const express = require('express');
const cors = require('cors');
const passport = require('passport');
const {Strategy: JWTStrategy, ExtractJwt} = require('passport-jwt');

const app = express();

console.log('app id:', process.env.MIRO_ID);

passport.use(new JWTStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.MIRO_SECRET,
  issuer: 'miro'
}, (payload, done) =>{
  console.log(payload);
  done(null, payload);
}));

app.use(cors({
  origin: 'http://localhost:3000'
}));

app.use(passport.authenticate('jwt', {session: false}));

app.use((req,res,next) => res.send('hello world team: '+ req.user.team));
app.listen(3001, () => console.log('backend listening on port 3001'));

