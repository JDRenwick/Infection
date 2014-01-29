var http = require("http");
var url = require('url');
var fs = require('fs');
var io = require('socket.io');

var server = http.createServer(function(request, response){
    console.log('Connection');
    var path = url.parse(request.url).pathname;

    switch(path){
        case '/':
            fs.readFile(__dirname + "/index.html", function(error, data){
                if (error){
                    response.writeHead(404);
                    response.write("oops this doesn't exist - 404");
                }
                else{
                    response.writeHead(200, {"Content-Type": "text/html"});
                    response.write(data, "utf8");
                }
				response.end();
            });
            break;
        default:
            response.writeHead(404);
            response.write("oops this doesn't exist - 404");
			response.end();
            break;
    }
});

server.listen(8080);

io = io.listen(server);
io = io.set('log level', 1);

// usernames which are currently connected to the chat
var status = "waiting"
var colours = ["red", "blue", "green", "yellow"]
var users = 0;
var usernames = {};

function newUser(name){
	this.name = name;
	this.colour = colours[users];
	this.playing = true;
	this.turn = false;
	this.infected = false;
	this.cures = 0;
	this.infections = 0;
}

io.sockets.on('connection', function (socket) {

	// when the client emits 'adduser', this listens and executes
	socket.on('adduser', function(username){
		if (status != "playing") {
		// we store the username in the socket session for this client
		socket.username = username;
		var user = new newUser(username)
		// add the client's username to the global list
		usernames[users] = user;
		// update the list of users in chat, client-side
		io.sockets.emit('updateusers', usernames);
		users += 1;
		if (users >= 4) {
			// update the list of users in chat, client-side
			socket.broadcast.emit('readyUp', usernames[0].name);
			}
		}
	
	});

	// when the client emits 'sendchat', this listens and executes
	socket.on('gameReady', function (i, t) {
	usernames[i].infected = true;
	usernames[t].turn = true;
	status = "playing";
		// we tell the client to execute 'updatechat' with 2 parameters
		io.sockets.emit('infect', usernames[i].name, "", usernames[i].name);
	});
	
	socket.on('update', function(data) {
		io.sockets.emit('gameUpdate', usernames);
	});
	
	socket.on('pass', function(x, y) {
		var player;
		var victim;
		for (i=0; i<users; i++) {
			if (usernames[i].name == x){
				player = i;
				console.log("1 player = "+usernames[i].name)
			}
			else if (usernames[i].name == y){
				victim = i;
				console.log("1 victim = "+usernames[i].name)
			}
		}
		console.log("2 player = "+usernames[player].infected)
		console.log("2 victim = "+usernames[victim].infected)
		if (usernames[victim].infected) {
			if (usernames[player].infected) {
				usernames[victim].turn = true;
				usernames[player].turn = false;
				usernames[player].playing = false;
				io.sockets.emit('kill', x, y);
			}
			else {
				usernames[player].infected = true;
				usernames[victim].turn = true;
				usernames[player].turn = false;
				io.sockets.emit('infect', x, y, x);
			}
		}
		else {
				usernames[victim].turn = true;
				usernames[player].turn = false;
			io.sockets.emit('passover', x, y);
		}
	});
	
	socket.on('doublePass', function(x, y) {
		var player;
		var victim;
		for (i=0; i<users; i++) {
			if (usernames[i].name == x)
				player = i;
			else if (usernames[i].name == y)
				victim = i;
		}
		if (usernames[player].infected) {
				usernames[victim].infected = true;
				usernames[victim].turn = true;
				usernames[player].turn = false;
				io.sockets.emit('infect', x, y, y);
		}
		else {
				usernames[victim].turn = true;
				usernames[player].turn = false;
			io.sockets.emit('passsuccess', x, y);
		}
	});
	
	socket.on('inject', function(x, y, z) {
		var player;
		var target;
		for (i=0; i<users; i++) {
			if (usernames[i].name == x)
				player = i;
			if (usernames[i].name == z)
				target = i;
		}
		if (usernames[target].infected) {
				usernames[player].turn = true;
				usernames[target].turn = false;
				usernames[target].playing = false;
				io.sockets.emit('cure', x, y, z);
		}
		else {
				usernames[player].turn = false;
				usernames[target].turn = true;
				usernames[player].playing = false;
			io.sockets.emit('arrest', x, y, z);
		}
	});
	
	

	// when the user disconnects.. perform this
	socket.on('disconnect', function(){
		// update list of users in chat, client-side
		io.sockets.emit('updateusers', usernames);
		// echo globally that this client has left
		socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected, game has been discontinued');
		// remove the username from global usernames list
		for (i=0; i<users; i++) {
			delete usernames[i];
		}
	});
});