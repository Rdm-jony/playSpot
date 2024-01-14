const express = require('express');
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors');
var dateFormat = require('dateformat');
const moment = require('moment');
const SibApiV3Sdk = require('@getbrevo/brevo');

require("dotenv").config()


const SSLCommerzPayment = require('sslcommerz-lts')
const store_id = process.env.sslId;
const store_passwd = process.env.sslPass
const is_live = false

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }));




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
        // await client.connect(); its crying meeeeeeeeee
        // Connect the client to the server	(optional starting in v4.7)
        const userCollection = client.db("playspot").collection("userCollection")
        const turfCollection = client.db("playspot").collection("turfCollection")
        const bookingCollection = client.db("playspot").collection("bookingCollection")

        app.put("/users", async (req, res) => {
            const userInfo = req.body;
            const result = await userCollection.updateOne({ email: userInfo?.email }, { $set: userInfo }, { upsert: true })
            res.send(result)
        })
        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;
            const result = await userCollection.findOne({ email: email })
            res.send(result)
        })
        app.put("/user/photo/:email", async (req, res) => {
            const email = req.params.email;
            const image = req.body;
            console.log(email)
            const result = await userCollection.updateOne({ email: email }, { $set: image }, { upsert: true })
            res.send(result)
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
        app.get("/allSpots/filter", async (req, res) => {
            const eventName = req.query.event;
            const allSpots = await turfCollection.find({}).toArray()
            const eventList = allSpots
            const filteringAllSpotSlist = []
            allSpots.map(spot => {
                spot.eventList.map(i => {
                    if (i.eventName.toLowerCase() == eventName.toLowerCase()) {

                        filteringAllSpotSlist.push(spot)
                    }
                })
            })
            res.send(filteringAllSpotSlist)

        })
        app.get("/allSpots/filterText", async (req, res) => {
            const searchText = req.query.search;

            const allSpots = await turfCollection.find({}).toArray()

            const filteringAllSpotSlist = allSpots.filter(spot => spot?.name.toString().includes(searchText))
            res.send(filteringAllSpotSlist)
        })
        app.post("/bookings", async (req, res) => {
            const trxId = new ObjectId().toString()
            const bookingInfo = req.body
            bookingInfo["trxId"] = trxId
            bookingInfo["paid"] = false
            bookingInfo["paymentDate"] = Date()

            const result = await bookingCollection.insertOne(bookingInfo)
            console.log(bookingInfo.email)

            let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

            let apiKey = apiInstance.authentications['apiKey'];
            apiKey.apiKey = process.env.brevoKey;

            let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

            sendSmtpEmail.subject = "My {{params.subject}}";
            sendSmtpEmail.htmlContent = `<html><body><h1>Payment successFull of ${bookingInfo.turfName}</h1>
                
                <h2>Event : ${bookingInfo.eventName}</h2>
                <h2>Slot : ${bookingInfo.slot}</h2>
                <h3>Transaction Id : ${bookingInfo.trxId}</h3>
                </body></html>`;
            sendSmtpEmail.sender = { "name": "Playespot.org", "email": "jonydascse@gmail.com" };
            sendSmtpEmail.to = [{ "email": `${bookingInfo.email}`, "name": `${bookingInfo.customerName}` }];

            apiInstance.sendTransacEmail(sendSmtpEmail).then(function (data) {

            }, function (error) {
                console.error(error);
            });

            const data = {
                total_amount: bookingInfo.totalPrice,
                currency: 'BDT',
                tran_id: trxId, // use unique tran_id for each api call
                success_url: `https://play-spot-ylsv-git-main-rdm-jony.vercel.app/bookings/success/${trxId}`,
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

                res.send({ "url": GatewayPageURL })

            });
        })

        app.post("/bookings/success/:trxId", async (req, res) => {
            if (req.params.trxId) {
                const filter = { trxId: req.params.trxId };
                const options = { upsert: true };
                const updateDoc = {
                    $set: {
                        paid: true
                    },
                };
                const result = await bookingCollection.updateOne(filter, updateDoc, options);
                res.redirect("https://659e961aa17148ece11945dc--charming-pika-dd91a0.netlify.app/")






                // const findBookdTurf = await bookingCollection.findOne({ trxId: req.params.trxId })


            }
        })

        app.get("/bookings/:date", async (req, res) => {

            var date = req.params.date
            var turfId = req.query.turfId
            var eventName = req.query.eventName
            var weekday = req.query.weekday

            const filterWithDate = await bookingCollection.find({ date: date, paid: true }).toArray()
            const filterWithTurfId = filterWithDate.filter(turf => turf.turfId == turfId)
            const filterWithEventName = filterWithTurfId.filter(turf => turf.eventName == eventName)

            const specificTurf = await turfCollection.findOne({ _id: new ObjectId(turfId) })
            const specifiEvent = specificTurf.eventList.find(i => i.eventName == eventName)
            var listOfTimeRange = [];
            var listOfEveryAvalilableHour = []


            if (weekday != "Friday") {
                for (var i = 0; i < specifiEvent.weekdayTime.length; i++) {
                    var timeRange = specifiEvent.weekdayTime[i].toString().split("-");

                    const startTimeClock = moment(timeRange[0].replace(" ", ""), 'HH:mm A');
                    const endTimeClock = moment(timeRange[1].replace(" ", ""), 'HH:mm A');
                    // const interval = moment.duration(1, 'hour');

                    const hoursArray = [];
                    while (startTimeClock.isSameOrBefore(endTimeClock)) {
                        hoursArray.push(startTimeClock.format('hh:mm A'));
                        startTimeClock.add(1, 'hours');

                    }


                    listOfTimeRange.push(hoursArray)

                }

            }
            else {
                for (var i = 0; i < specifiEvent.weekendTime.length; i++) {
                    var timeRange = specifiEvent.weekendTime[i].toString().split("-");

                    const startTimeClock = moment(timeRange[0].replace(" ", ""), 'HH:mm A');
                    const endTimeClock = moment(timeRange[1].replace(" ", ""), 'HH:mm A');
                    const interval = moment.duration(1, 'hour');

                    const hoursArray = [];
                    while (startTimeClock.isSameOrBefore(endTimeClock)) {

                        hoursArray.push(startTimeClock.format('hh:mm A'));
                        startTimeClock.add(interval);
                    }
                    listOfTimeRange.push(hoursArray)

                }
            }



            // Example usage

            listOfTimeRange.map(timeRangeOrginal => {

                filterWithEventName.map(turf => {

                    var slot = `${turf.slot}`.split("-")

                    if (timeRangeOrginal.includes(slot[0])) {

                        const startTime = moment(timeRangeOrginal[0].replace(" ", ""), "HH:mm A").format('hh:mm A');
                        const endTime = moment(timeRangeOrginal[timeRangeOrginal.length - 1].replace(" ", ""), "HH:mm A").format('hh:mm A');
                        const selectedStartTime = moment(slot[0].replace(" ", ""), "HH:mm A").format('hh:mm A');
                        const selectedEndTime = moment(slot[1].replace(" ", ""), "HH:mm A").format('hh:mm A');

                        const result = findAvailableTimeRange(startTime, endTime, selectedStartTime, selectedEndTime);

                        const availableHour = eeryHourBeetweenRange(result)
                        availableHour.map(i => listOfEveryAvalilableHour.push(i))



                    } else {
                        timeRangeOrginal.map(i => listOfEveryAvalilableHour.push(i))
                    }




                }


                )





            })


            function eeryHourBeetweenRange(result) {
                for (var i = 0; i < result.length; i++) {
                    var timeRange = result[i].toString().split("-");
                    // console.log(timeRange)
                    const startTimeClock = moment(timeRange[0], 'HH:mm A');
                    const endTimeClock = moment(timeRange[1], 'HH:mm A');
                    // const interval = moment.duration(1, 'hour');
                    var everyHour = []
                    while (startTimeClock.isSameOrBefore(endTimeClock)) {
                        everyHour.push(startTimeClock.format('hh:mm A'))

                        startTimeClock.add(1, 'hours');

                    }

                    return everyHour;



                }
            }
            function findAvailableTimeRange(startTime, endTime, selectedStartTime, selectedEndTime) {
                // Convert the time strings to Date objects for easier comparison
                const startDate = new Date(`2024-01-01 ${startTime}`);
                const endDate = new Date(`2024-01-01 ${endTime}`);
                const selectedStartDate = new Date(`2024-01-01 ${selectedStartTime}`);
                const selectedEndDate = new Date(`2024-01-01 ${selectedEndTime}`);

                // Check if the selected time range is within the given time range
                if (selectedStartDate < startDate || selectedEndDate > endDate) {
                    return "Selected time range is not within the given time range.";
                }

                // Check if there is an available time range before the selected time range
                const availableBefore = selectedStartDate > startDate
                    ? `${startTime} - ${selectedStartTime}`
                    : null;

                // Check if there is an available time range after the selected time range
                const availableAfter = selectedEndDate < endDate
                    ? `${selectedEndTime} - ${endTime}`
                    : null;

                // Combine the available time ranges
                const availableTimeRanges = [];
                if (availableBefore) {
                    availableTimeRanges.push(availableBefore);
                }
                if (availableAfter) {
                    availableTimeRanges.push(availableAfter);
                }
                console.log(availableTimeRanges)
                return availableTimeRanges;

            }


            if (listOfEveryAvalilableHour.length == 0) {

                listOfTimeRange.map(list => {
                    list.map(i => listOfEveryAvalilableHour.push(i))
                });
            }

            res.send(listOfEveryAvalilableHour)
        })


        app.get("/mybooking/:email", async (req, res) => {
            const email = req.params.email;
            const result = await bookingCollection.find({ email: email }).toArray()
            res.send(result)
        })

        app.post("/review", async (req, res) => {
            const reviewInfo = req.body;
            const turfId = reviewInfo.turfId;
            const findTurf = await turfCollection.findOne({ _id: new ObjectId(turfId) })
            if (findTurf?.reviews) {
                var alreadyFound = findTurf.reviews.find(i => i.email == reviewInfo.email)
                if (alreadyFound) {
                    return;
                } else {
                    const result = await turfCollection.updateOne({ _id: new ObjectId(turfId) }, { $push: { reviews: reviewInfo } })
                    res.send(result)

                }


            } else {
                const reviews = [reviewInfo]
                const updateDoc = {
                    $set: {
                        reviews: reviews
                    }
                }
                const options = { upsert: true }
                const result = await turfCollection.updateOne({ _id: new ObjectId(turfId) }, updateDoc, options);
                res.send(result)

            }
        })




    } finally {
        // Ensures that the client will close when you finish/error

    }
}
run().catch(console.dir);

