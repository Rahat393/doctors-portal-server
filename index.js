const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require('jsonwebtoken');
const cors = require("cors");
const { request } = require("express");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lnoy20s.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next){
  const authHeader = req.headers.authorization;
  if(!authHeader){
    res.status(401).send('unauthorized access')
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
    if(err){
      res.status(403).send({message: 'forbidden access'})
    }
    req.decoded = decoded;
    next()
  })
}

//  console.log(uri);

async function run() {
  try {
    const appointmentOptionCollection = client
      .db("doctors-portal2")
      .collection("AppointmentOptions");
    const bookingsCollection = client
      .db("doctors-portal2")
      .collection("bookings");
    const usersCollection = client
      .db("doctors-portal2")
      .collection("users");
    const paymentsCollection = client
      .db("doctors-portal2")
      .collection("payment");

    app.get("/appointmentopptions", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const options = await appointmentOptionCollection.find(query).toArray();
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
      options.forEach(option => {
        const optionBooked = alreadyBooked.filter(book  => book.treatment === option.name);
        const bookedSlots = optionBooked.map(book => book.slot)
        const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot));
        option.slots = remainingSlots;
        // console.log(option.name, remainingSlots.length, date);
      });
      res.send(options);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        appointmentDate: booking.appointmentDate,
        email : booking.email,
        treatment : booking.treatment
      }
      const alreadyBooked = await bookingsCollection.find(query).toArray()

      if(alreadyBooked.length){
        const message = `You have already booked on ${booking.appointmentDate}. Try another day.`
        return res.send({acknowledged : false, message})
      }
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/bookings", verifyJWT, async(req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if(email !==  decodedEmail){
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email: email}
      const bookings = await bookingsCollection.find(query).toArray()
      res.send(bookings)
    })

    app.get('/jwt', async(req, res) => {
      const email = req.query.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user){
        const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '1y'})
        return res.send({accessToken : token})
      }
      // console.log(user);
      res.status(403).send({accessToken: ''})
    })

    app.post("/users", async(req, res) => {
      const users = req.body;
      const result = await usersCollection.insertOne(users)
      res.send(result)
    })

    app.get('/users', async(req, res) => {
      const query = {}
      const result = await usersCollection.find(query).toArray();
      res.send(result)
    })

    app.put('/users/admin/:id', verifyJWT, async(req, res) => {
      const decodedEmail =req.decoded.email;
      const query = {email : decodedEmail};
      const user = await usersCollection.findOne(query);

      if(user.role !== 'admin'){
        res.status(403).send({message: 'forbidden access'})
      }

      const id = req.params.id;
      const filter = {_id : ObjectId(id)}
      const options = {upsert: true}
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc, options)
      res.send(result)
    })

    app.get('/users/admin/:email', async(req, res) => {
      const email = req.params.email;
      const query = {email}
      const user = await usersCollection.findOne(query)
      res.send({isAdmin: user?.role === 'admin'}) 
    });

    app.get('/appointmentspecialty', async(req, res) => {
      const query = {};
      const result = await appointmentOptionCollection.find(query).project({name: 1}).toArray();
      res.send(result)
    })

    // temporary to update price field on appointment options


    // app.get('/addPrice', async (req, res) => {
    //     const filter = {}
    //     const options = { upsert: true }
    //     const updatedDoc = {
    //         $set: {
    //             price: 99
    //         }
    //     }
    //     const result = await appointmentOptionCollection.updateMany(filter, updatedDoc, options);
    //     res.send(result);
    // })

    app.get('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: ObjectId(id)}
      const booking = await bookingsCollection.findOne(query);
      res.send(booking)
    })

    // payment getway

    app.post('/create-payment-intent', async(req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: 'usd',
        amount: amount,
        "payment_method_types": [
          "card"
        ]
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    });

    app.post('/payments', async (req, res) =>{
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId
      const filter = {_id: ObjectId(id)}
      const updatedDoc = {
          $set: {
              paid: true,
              transactionId: payment.transactionId
          }
      }
      const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc)
      res.send(result);
  })
  } finally {
  }
}
run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("doctors portal surver running");
});

app.listen(port, () => console.log(`doctors portal running on port ${port}`));
