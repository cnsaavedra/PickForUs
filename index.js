const app = require('express')();
var express = require('express');
const server = require('http').Server(app);
const io = require('socket.io')(server);
var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/chat_database';
var router = express.Router();
var assert = require('assert');


MongoClient.connect(url, function (err, db) {
    var messagesCollection = db.collection('messages');


    const tech = io.of('/tech');
    var connections = [];
    var timer = 5;
    var topWords = [];



    tech.on('connection', (socket) => {
        connections.push(socket);
        console.log("Connections: " + connections.length);


        //FOR TIMER
        var ChatCountdown = setInterval(function(){
            socket.emit('time_server', timer);
            if(timer !== 0){
                timer--;
            }
            else if(timer === 0 || timer < 0){
                socket.emit('time_server', timer);
                clearInterval(ChatCountdown);
            }
            }, 1000);



        socket.on('join', (data) => {
            socket.join(data.room);
            tech.in(data.room).emit('server_message', connections.length + ' users connected');
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
            tech.in(data.room).emit('message', data.msg);
        });


        io.on('disconnect', () => {
            console.log('User Disconnected');
            tech.emit('message', 'User Disconnected');
        });


    });

    const port = 3000;
    var topFood = 0;
    var topFoodArray = 0;

    server.listen(port, () => {
        console.log('Server is listening on Port: ${port}');
    });

    app.get('/get-data', function(req, res, next) {
        db.collection("messages", function (err, collection) {
            collection.aggregate([{$group: {_id: "$text", MyResults: {$sum: 1}}}]).toArray(function (err, data) {
                for(var i =0; i < data.length; i++){
                    if(data[i].MyResults > topFood){
                        topFoodArray = i;
                    }
                }
                topFood = data[topFoodArray]._id;
                console.log("Top Food: " + topFood);
                res.json(topFood);
            })
        });
    });


    app.get('/', (req, res) => {
        res.sendFile(__dirname + '/public/index.html');
    });

    app.get('/food', (req, res) => {
        res.sendFile(__dirname + '/public/food.html');
    });
    app.get('/destination', (req, res) => {
        res.sendFile(__dirname + '/public/destination.html');
    });
    app.get('/pickforusplease', (req, res) => {
        res.sendFile(__dirname + '/public/pickforusplease.html');
    });

});