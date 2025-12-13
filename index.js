require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASS}@cluster0.oz9hxy1.mongodb.net/?appName=Cluster0`;

// mongodb client

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("clubSphere");
    const clubCollection = db.collection("clubs");
    const usersCollection = db.collection("users");

    // load all clubs
    app.get("/clubs", async (req, res) => {
      const result = await clubCollection.find().toArray();
      res.send(result);
    });

    // load club by id
    app.get("/clubs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await clubCollection.findOne(query);
      res.send(result);
    });

    // add clubs
    app.post("/clubs/add", async (req, res) => {
      const data = req.body;
      // console.log(data)
      const clubData = {
        ...data,
        createdAt: new Date().toLocaleDateString(),
        updatedAt: new Date().toLocaleDateString(),
        members: [],
        status: "pending",
      };
      const result = await clubCollection.insertOne(clubData);
      res.send(result);
    });

    // update club status
    app.patch("/clubs/:id/status", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const statusInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: statusInfo.status,
        },
      };
      const result = await clubCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // adding new users
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const userData = {
        ...newUser,
        role: "user",
        createdAt: new Date().toLocaleDateString(),
      };
      const result = await usersCollection.insertOne(userData);
      res.send(result);
    });

    // getting users

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // stripe api

    app.post("/payment-checkout-session", async (req, res) => {
      const clubInfo = req.body;
      const fee = parseInt(clubInfo.fee) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: fee,
              product_data: {
                name: `Please pay for: ${clubInfo.clubName}`,
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          parcelId: clubInfo.clubId,
        },
        customer_email: clubInfo.userEmail,
        success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
      });

      res.send({ url: session.url });
    });

    // verify payment success
    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // console.log(session);

      if(session.payment_status === "paid"){
        const clubId = session.metadata.parcelId;
        // console.log(clubId);

        const query = { _id: new ObjectId(clubId) };
      }
      
    });
  } finally {
  }
}

app.get("/", (req, res) => {
  res.send("Hello from Express!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

run().catch(console.dir);
