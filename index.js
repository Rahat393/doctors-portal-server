const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const { request } = require("express");
require("dotenv").config();
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
//  console.log(uri);

async function run() {
  try {
    const appointmentOptionCollection = client
      .db("doctors-portal2")
      .collection("AppointmentOptions");
    const bookingsCollection = client
      .db("doctors-portal2")
      .collection("bookings");

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
        console.log(option.name, remainingSlots.length, date);
      });
      res.send(options);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("doctors portal surver running");
});

app.listen(port, () => console.log(`doctors portal running on port ${port}`));
