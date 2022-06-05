/*eslint-env node*/
const express = require('express');
const Redis = require('ioredis');
const morgan = require('morgan');
const {nanoid} = require('nanoid/non-secure');
const passport = require('passport');
const {Strategy: JWTStrategy, ExtractJwt} = require('passport-jwt');
const rateLimit = require('express-rate-limit');
const getRawBody = require('raw-body');

const production = process.env.NODE_ENV === 'production';

const MiroJwtStrategy = new JWTStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.MIRO_SECRET,
  issuer: 'miro'
}, (payload, done) => { done(null, true) });

passport.use('miro-jwt', MiroJwtStrategy);

const redisClient = new Redis(process.env.UPSTASH_REDIS_URL,
                              {lazyConnect:true});

const TTL = parseInt(process.env.MAX_AGE) || 10;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'uniquelocal');

// logging
app.use(morgan( production ? 'short' : 'dev'));

// main routes for image handling
app.get('/img/:id',
	rateLimit({ // throttling to db allowances
	  windowMs: 1000 * 60 * 5,
	  max: 400
	}),
	async (req,res) => {
	  const query = await redisClient
		.getBuffer(req.params.id)
		.catch(console.log);
	  // query hit => return image
	  if(query) {
	    return res.set({
	      'Content-Type':'image/svg+xml',
	      'Content-Encoding': 'deflate',
	      'Cache-Control': 'public, immutable, max-age='+TTL
	    }).send(query);
	  }
	  // query miss => not found
	  return res.sendStatus(404);
	});

app.post('/img',
	 rateLimit({
	   windowMs: 1000 * 60 * 15, // 15 minutes
	   max: 10 * 15, // 10 images per minute per ip
	   standardHeaders: true, legacyHeaders: false
	 }),
         // block any request without a frontend token
         passport.authorize('miro-jwt', {session: false}),
         // handle request
         async (req, res) => {
           if(!req.is('image/svg+xml') ||
	      req.get('Content-Encoding') !== 'deflate'
	     ) // bad request
             return res.sendStatus(400);
	   req.body = await getRawBody(req, {limit: '256kb'}).catch(console.log);
           // a random identifier
           const id = nanoid();
           // try to put body in redis: OK => created
           if (await redisClient.set(id, req.body, 'ex', TTL).catch(console.log)){
             return  res.status(201).send({id});
	   }
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
