const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/chat_database';

MongoClient.connect(url, function (err, db) {
    if (err) {
        console.log(err);
    } else {

        var messagesCollection = db.collection('messages');

        const app = express();
        const server = http.createServer(app);
        const io = socketIO(server);

        var connections = [];
        var timer = 60;

        var top3 = [];
        var top3Arrays = [];
        var top3NameArrays = [];


        function hasDuplicates(array) {
            return (new Set(array)).size !== array.length;
        }

        io.on('connection', (socket) => {
            connections.push(socket);
            console.log("Connections: " + connections.length);

            //#TODO on first iteration results wont appear, previous arrays from previous sessions appear
            //#TODO maybe for array, make it a session variable?

            //FOR TIMER
            var ChatCountdown = setInterval(function(){
                socket.emit('time_server', timer);
                timer--; // had to remove the if (timer > 0) because it creates two multiples of else if(timer === 0)(figure out why later)
                if(timer === 0 || timer < 0){
                    timer = 0;
                    socket.emit('time_server', timer);
                    clearInterval(ChatCountdown);
                }
                }, 1000);

                app.get('/get-data', async function(req, res, next) {
                    try{
                    await db.collection("messages", function (err, collection) {
                        collection.aggregate(
                            [
                                { $group : {_id: "$text", MyResults: {$sum: 1}}},
                                { $out : "rankings" }
                            ] ).toArray(function (err, data) {
                        });
                        db.collection("rankings", async function (err, collection) {
                            await collection.find().sort({MyResults: -1}).toArray(function (err, data) {
                                //puts all the count of each food in an array through numbers
                                if (typeof data !== 'undefined' && data.length > 0) {
                                    for(var i = 0; i < data.length; i++){
                                        top3Arrays.push(data[i].MyResults);
                                        top3NameArrays.push(data[i]._id);
                                        top3[i] = top3NameArrays[i];
                                    }
                                }
                                console.log("Top 3: " + top3NameArrays);
        
                                if(hasDuplicates(top3Arrays)){
                                    res.json({top3: top3, duplicate: true});
                                }
        
                                else if(!hasDuplicates(top3Arrays)){
                                    res.json({top3: top3, duplicate: false});
                                }
        
                                console.log("Top Food: " + top3);
                            });
                        });
                    });
                    }catch(err){
                        console.log(err);
                    }finally{
                        db.close();
                    }
                });
        
            socket.on('join', (data) => {
                socket.join(data.room);
                io.in(data.room).emit('server_message', connections.length + ' users connected');
                io.in(data.room).emit('server_message', 'You have 60 seconds to put in your thoughts!');
            });

            socket.on('message', (data) => {
                // includes/excludes words (compare to a dictionary later) to database
                if (data.msg.trim().indexOf(' ') == -1) {
                    if(data.msg.length <= 3){
                        console.log(data.msg + ' too short to be a food name')
                    }
                    else if(data.msg.length >= 3 && data.msg !== "want" && data.msg !== "some" && data.msg !== "have" && data.msg !== "test") {
                        messagesCollection.insertOne({text: data.msg}, function (err, res) {
                            console.log(data.msg + ' inserted into messagesCollection')
                        });
                        console.log(data.msg + ' might be food so added to database')
                    }
                }
                else { // sentence includes more than one word
                    var words = data.msg.split(" ");
                    for (var i = 0; i < words.length; i++) {
                        console.log(words[i] + ' are the split messages');
                        if (words[i].length <= 3) {
                            console.log(words[i] + ' too short to be a food name')
                        }
                        else if (words[i].length >= 3 && words[i] !== "want" && words[i] !== "some" && words[i] !== "have" && isNaN(words[i])) {
                            messagesCollection.insertOne({text: words[i]}, function (err, res) {
                            });
                            console.log(words[i] + ' might be food so added to database')
                        }
                    }
                }
                io.in(data.room).emit('message', data.msg);
            });


            io.on('disconnect', () => {
                console.log('User Disconnected');
                io.emit('message', 'User Disconnected');
                top3 = [];
                db.close();
            });


        });

        const port = process.env.PORT || 3000;

        server.listen(port, () => {
            console.log('Server is listening on Port: ${port}');
        });


        app.get('/', (req, res) => {
            res.sendFile(__dirname, '../src/components/Main.js');
        });

        app.get('/food', (req, res) => {
            res.sendFile(__dirname, '../src/components/Food.js');
        });
    }
});