const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lnoy20s.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
//  console.log(uri);

 async function run() {
  try{
      const appointmentOptionCollection = client.db('doctors-portal2').collection('AppointmentOptions')

      app.get('/appointmentopptions', async(req, res) => {
        const query = {};
        const options = await appointmentOptionCollection.find(query).toArray();
        res.send(options)
      })
  }
  finally{

  }
 }
 run().catch(console.log);


app.get('/', async(req, res) => {
  res.send('doctors portal surver running')
})

app.listen(port, () => console.log(`doctors portal running on port ${port}`))