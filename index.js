const express = require('express');
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors');
require("dotenv").config()


const SSLCommerzPayment = require('sslcommerz-lts')
const store_id = process.env.sslId;
const store_passwd = process.env.sslPass
const is_live = false

app.use(cors())
app.use(express.json())



app.get("/", async (req, res) => {
    res.send("playspot server running")
})
app.listen(port, () => {
    console.log(`playspot server running on ${port}`)
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@cluster0.tbsccmb.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        // Connect the client to the server	(optional starting in v4.7)
        const userCollection = client.db("playspot").collection("userCollection")
        const turfCollection = client.db("playspot").collection("turfCollection")
        const bookingCollection = client.db("playspot").collection("bookingCollection")

        app.put("/users", async (req, res) => {
            const userInfo = req.body;
            const result = await userCollection.updateOne({ email: userInfo?.email }, { $set: userInfo }, { upsert: true })
            res.send(result)
        })
        app.get("/users/:email",async(req,res)=>{
            const email=req.params.email;
            const result=await userCollection.findOne({email:email})
            console.log(result)
        })

        app.post("/addTurf", async (req, res) => {
            const turfInfo = req.body;
            const result = await turfCollection.insertOne(turfInfo);
            res.send(result)
        })
        app.get("/allSpots", async (req, res) => {
            const result = await turfCollection.find({}).toArray()
            res.send(result)
        })
        app.post("/bookings", async (req, res) => {
            // const result = await bookingCollection.insertOne(req.body)
            // res.send(result)
            const trxiId= new ObjectId().toString()
            const bookingInfo = req.body;
            const data = {
                total_amount: bookingInfo.totalPrice,
                currency: 'BDT',
                tran_id:trxiId, // use unique tran_id for each api call
                success_url: `https://play-spot-git-main-rdm-jony.vercel.app/bookings/success/${trxiId}`,
                fail_url: 'http://localhost:3030/fail',
                cancel_url: 'http://localhost:3030/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'Courier',
                product_name: 'Computer.',
                product_category: 'Electronic',
                product_profile: 'general',
                cus_name: bookingInfo.totalPrice,
                cus_email: bookingInfo.email,
                cus_add1: 'Dhaka',
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: '01711111111',
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };
            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL
                // res.redirect(GatewayPageURL)
                res.send({"url":GatewayPageURL})
                
            });
        })

        app.post("/bookings/success/:trxId",(req,res)=>{
            const trxId=req.params.trxId
            console.log(trxId)
        })

        app.get("/bookings/:date", async (req, res) => {

            var date = req.params.date
            var turfId = req.query.turfId
            var eventName = req.query.eventName
            const filterWithDate = await bookingCollection.find({ date: date }).toArray()
            const filterWithTurfId = filterWithDate.filter(turf => turf.turfId == turfId)
            const filterWithEventName = filterWithTurfId.filter(turf => turf.eventName == eventName)
            var timeSlotList = []

            filterWithEventName.map(turf => {
                var slot = `${turf.slot}`.split("-")
                slot.map(i => timeSlotList.push(i))
            })
            res.send(timeSlotList)
        })




    } finally {
        // Ensures that the client will close when you finish/error

    }
}
run().catch(console.dir);

