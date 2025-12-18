require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const app = express();
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");
const serviceAccount = require("./FBAdminSDK.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    // console.log(idToken);
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    // console.log(idToken);
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

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
    const eventCollection = db.collection("events");
    const membershipCollection = db.collection("memberships");
    const registrationsCollection = db.collection("registrations");
    const paymentCollection = db.collection("payments");

    await membershipCollection.createIndex({ paymentId: 1 }, { unique: true });
    await paymentCollection.createIndex({ paymentId: 1 }, { unique: true });
    await registrationsCollection.createIndex(
      { paymentId: 1 },
      { unique: true }
    );

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
    app.post("/clubs/add",verifyFBToken, async (req, res) => {
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

    // update club info
    app.patch("/clubs/:id/update", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const data = req.body;
      const query = { _id: new ObjectId(id) };

      const clubData = {
        ...data,
        updatedAt: new Date().toLocaleDateString(),
      };
      const updatedDoc = {
        $set: clubData,
      };
      // console.log(updatedDoc);
      const result = await clubCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // delete clubs
    app.delete("/clubs/:id", verifyFBToken, async (req, res) => {
      const { id } = req.params;
      //    const objectId = new ObjectId(id)
      // const filter = {_id: objectId}
      const result = await clubCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    // get event data
    app.get("/events", async (req, res) => {
      const result = await eventCollection.find().toArray();

      res.send(result);
    });

    // load event by id
    app.get("/events/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await eventCollection.findOne(query);
      res.send(result);
    });

    // add events
    app.post("/events/add",verifyFBToken, async (req, res) => {
      const data = req.body;
      // console.log(data)
      const eventData = {
        ...data,
        createdAt: new Date().toLocaleDateString(),
      };
      const result = await eventCollection.insertOne(eventData);
      res.send(result);
    });

    // update event info
    app.patch("/events/:id/update", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const data = req.body;
      const query = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: data,
      };
      // console.log(updatedDoc);
      const result = await eventCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // delete events
    app.delete("/events/:id", verifyFBToken, async (req, res) => {
      const { id } = req.params;
      //    const objectId = new ObjectId(id)
      // const filter = {_id: objectId}
      const result = await eventCollection.deleteOne({
        _id: new ObjectId(id),
      });

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

    // update user info
    app.patch("/users/:id/update", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const data = req.body;
      const query = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: data,
      };
      // console.log(updatedDoc);
      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // getting users

    app.get("/users", verifyFBToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // stripe api

    app.post("/payment-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo);

      if (paymentInfo.type === "club") {
        const { clubInfo = {} } = paymentInfo;
        // console.log(clubInfo)
        // return
        const fee = clubInfo?.fee * 100;
        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: fee,
                product_data: {
                  name: `Please pay for: ${clubInfo?.clubName}`,
                },
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          metadata: {
            parcelId: clubInfo?.clubId,
            type: "clubMembership",
          },
          customer_email: clubInfo?.userEmail,
          success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
        });
        res.send({ url: session.url });
      }

      if (paymentInfo.type === "event") {
        console.log(paymentInfo);
        const { eventInfo } = paymentInfo;
        const eventFee = eventInfo.fee || 0;
        const fee = parseInt(eventFee) * 100;
        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: fee,
                product_data: {
                  name: `Please pay for: ${eventInfo.title}`,
                },
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          metadata: {
            parcelId: eventInfo.eventId,
            clubId: eventInfo.clubId,
            // clubName: eventInfo.clubName,
            type: "event",
          },
          customer_email: eventInfo.userEmail,
          success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
        });

        res.send({ url: session.url });
      }
    });

    // verify payment success
    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // console.log(session);

      if (session.payment_status === "paid") {
        if (session.metadata.type === "clubMembership") {
          const clubId = session.metadata.parcelId;
          const membershipInfo = {
            clubId,
            userEmail: session.customer_email,
            status: "active",
            joinedAt: new Date().toLocaleDateString(),
            paymentId: session.payment_intent,
          };

          const paymentDetails = {
            userEmail: session.customer_email,
            clubId,
            amount: session.amount_total / 100,
            type: session.metadata.type,
            paymentId: session.payment_intent,
            status: session.payment_status,
            createdAt: new Date().toLocaleDateString(),
          };
          const query = {
            _id: new ObjectId(clubId),
            "members.email": { $ne: session.customer_email },
          };

          const updateMember = {
            $push: {
              members: {
                email: session.customer_email,
              },
            },
          };
          const result = await clubCollection.updateOne(query, updateMember);

          await membershipCollection.insertOne(membershipInfo);
          await paymentCollection.insertOne(paymentDetails);
          res.send(result);
        }
        if (session.metadata.type === "event") {
          const eventId = session.metadata.parcelId;
          const regInfo = {
            eventId,
            userEmail: session.customer_email,
            clubId: session.metadata.clubId,
            status: "registered",
            paymentId: session.payment_intent,
            regAt: new Date().toLocaleDateString,
          };

          const paymentDetails = {
            userEmail: session.customer_email,
            eventId,
            clubId: session.metadata.clubId,
            amount: session.amount_total / 100,
            type: session.metadata.type,
            paymentId: session.payment_intent,
            status: session.payment_status,
            createdAt: new Date().toLocaleDateString(),
          };
          const query = {
            _id: new ObjectId(eventId),
            "attendees.email": { $ne: session.customer_email },
          };
          const updateAttendees = {
            $push: {
              attendees: {
                email: session.customer_email,
              },
            },
          };
          const result = await eventCollection.updateOne(
            query,
            updateAttendees
          );
          await registrationsCollection.insertOne(regInfo);
          await paymentCollection.insertOne(paymentDetails);

          res.send(result);
        }
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
