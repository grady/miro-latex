const express = require('express');
const Redis = require('ioredis');
const morgan = require('morgan');
const passport = require('passport');
const {Strategy: JWTStrategy, ExtractJwt} = require('passport-jwt');
const {v4: uuid4} = require('uuid');

const production = process.env.NODE_ENV === 'production';

const MiroJwtStrategy = new JWTStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.MIRO_SECRET,
  issuer: 'miro'
}, (payload, done) => {done(null, payload)});

passport.use('miro-jwt', MiroJwtStrategy);

const app = express();
const redisClient = new Redis(process.env.UPSTASH_REDIS_URL);

app.use(morgan( production ? 'short' : 'dev'));


app.get('/img/:id', (req, res, next) => {
  redisClient.get(req.params.id, (err, svg)=>{
    if(svg) {
      return res.set('Content-Type', 'image/svg+xml').send(svg);
    } else {
      return res.sendStatus(404); //not found
    }
  });
});

app.post('/img',
	 // block any request without a frontend token
	 passport.authorize('miro-jwt', {session: false}),
	 // parse the body to string
	 express.text({type: 'image/svg+xml', limit: 2**18 /*256kb*/}),
	 (req,res,next) => {
	   //console.log(req.body);
	   if (!req.body) {
	     res.sendStatus(400); //bad request
	   }
	   let id = uuid4();
	   redisClient.set(id, req.body, 'ex', 120, (err,ok) => {
	     if (err) {
	       console.log(err);
	       return res.sendStatus(500); //server error
	     } else {
	       console.log(id);
	       res.status(201).send({id}); //created
	     }
	   });
	   
	 });


if(production) {
  // serve the build output in production
  app.use(express.static('dist'));
} else { 
  // proxy the vite server in dev
  app.use(require('http-proxy-middleware')
	  .createProxyMiddleware({target:'http://localhost:3000/'}));  
}

//start the server
const server = require('http')
      .createServer(app)
      .listen(
	process.env.PORT || 3001,
	() => console.log(`Backend listening on ${server.address().port}`)
      );
