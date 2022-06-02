const express = require('express');
const Redis = require('ioredis');
const morgan = require('morgan');
const {nanoid} = require('nanoid/non-secure');
const passport = require('passport');
const {Strategy: JWTStrategy, ExtractJwt} = require('passport-jwt');


const production = process.env.NODE_ENV === 'production';

const MiroJwtStrategy = new JWTStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.MIRO_SECRET,
  issuer: 'miro'
}, (payload, done) => {done(null, true)});

passport.use('miro-jwt', MiroJwtStrategy);

const redisClient = new Redis(process.env.UPSTASH_REDIS_URL,
			      {lazyConnect:true});

const app = express();

// logging 
app.use(morgan( production ? 'short' : 'dev'));

// main routes for image handling
app.get('/img/:id', async (req,res,next) => {
  const query = await redisClient.get(req.params.id).catch(console.log);
  // query hit => return image
  if(query) return res.set('Content-Type', 'image/svg+xml').send(query);
  // query miss => not found
  return res.sendStatus(404);
});

app.post('/img',
	 // block any request without a frontend token
	 passport.authorize('miro-jwt', {session: false}),
	 // parse body
	 express.text({type: 'image/svg+xml', limit: 2**18 /*256kb*/}),
	 // handle request
	 async (req, res, next) => {
	   if(!req.body) // empty body => bad request
	     return res.status(400).send({msg:'Request body empty'});
	   // a random identifier
	   const id = nanoid();
	   // try to put body in redis: OK => created
	   if ( await redisClient.set(id, req.body, 'ex', 10).catch(console.log) ) 
	     return res.status(201).send({id}); 
	   // hopefully we never get here => server error
	   return res.sendStatus(500); 
	 });

// routes to serve frontend
if(production) {
  // serve the build output in production
  app.use(express.static('dist'));
} else { 
  // proxy the vite server in dev
  app.use(require('http-proxy-middleware')
	  .createProxyMiddleware({target:'http://localhost:3000/'}));  
}

//start the server
redisClient.connect().then( () => {
  console.log('Redis connected');
  const server = app.listen(
    process.env.PORT || 3001,
    () => console.log(`Backend listening on ${server.address().port}`)
  );
});


