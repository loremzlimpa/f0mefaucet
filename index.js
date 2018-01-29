var express = require('express')
var ws = require('ws')
var moment = require('moment')
var app = express()
var Recaptcha = require('recaptcha-verify');
var recaptcha = new Recaptcha({
    secret: 'recaptcha secret',
    verbose: true
});

var Web3 = require('web3');
var Tx = require('ethereumjs-tx');
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8293"));

var bot_address = "bot's eth public addresss";
var bot_privatekey = "bot's private key";//signing tx directly in this app,
var account = bot_address.toLowerCase();
var myaccount = account;
var key = new Buffer(bot_privatekey, 'hex');

const gasPrice = web3.eth.gasPrice;
const gasPriceHex = web3.toHex(gasPrice);
const gasLimitHex = web3.toHex(30000);

var accounts = [];
const db = require("./db.js");

db.accountLoader.on("loaded", (loaded) => {
    if (loaded === undefined || loaded === null)
      return;

    accounts = loaded;
    console.log(accounts);
});
db.loadAccounts();

const botometer = require('node-botometer');
const B = new botometer({
  consumer_key: 'your twitter consumer key',
  consumer_secret: 'your twitter consumer secret',
  access_token: null,
  access_token_secret: null,
  app_only_auth: true,
  mashape_key: 'your mashape_key https://market.mashape.com/OSoMe/botometer',
  rate_limit: 0,
  log_progress: true,
  include_user: true,
  include_timeline: false,
  include_mentions: false
});

var Twit = require('twit');

var T = new Twit({
  consumer_key:         'your twitter consumer key',
  consumer_secret:      'your twitter consumer secret',
  access_token:         '', //no need
  access_token_secret:  '', //no need
	app_only_auth:        true,
  timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
})

app.get('/', function (req, res) {
   res.sendfile(__dirname + '/public/index.html');
})
var server = app.listen(3000, function () {
   console.log('Example app listening on port 3000!')
})


function get_messageJSON(msg){
  var new_obj = {message:msg};
  return JSON.stringify(new_obj);
}

//ws : the websocket used to reply to client's browser
function send_nuko(to, amount, ws, userid)  {
        var number = web3.eth.getTransactionCount(account);
        var tra = {
        	nonce:web3.toHex(number),
            gasPrice: gasPriceHex,
            gasLimit: gasLimitHex,
            value: web3.toHex(web3.toWei(amount,"ether")),
            data: 0x0,
            from: account,
            to: to
        };

        var tx = new Tx(tra);
        tx.sign(key);

        var stx = tx.serialize();
        web3.eth.sendRawTransaction('0x' + stx.toString('hex'), (err, hash) => {
            if (err) {
                ws.send(get_messageJSON("Error! " + err));
                return;
            }
						//update database
						accounts[userid].lasttx = moment().format();
						console.log("updated tx", accounts[userid].lasttx);
						db.update(userid, moment().format()) ;
            ws.send(get_messageJSON("Success! "));
            // + "http://nekonium.network/tx/"+hash
            ws.send(JSON.stringify({'blocklink':"http://nekonium.network/tx/"+hash}));
        });
  };

app.on('unhandledRejection', error => {
	  // Will print "unhandledRejection err is not defined"
	  console.log('unhandledRejection', error.message);
	});

var blocks = "";
var funds = "";

var WebSocketServer = require('ws').Server, wss = new WebSocketServer({server})

const WebSocket = require('ws');
wss.broadcast = function broadcast() {

  console.log("client numbers ", wss.clients.size);
  if (wss.clients.size == 0)
    return;
  try {
    blocks = web3.eth.getBlock("latest").number;
    funds = parseFloat(web3.fromWei(web3.eth.getBalance(bot_address),'ether')).toFixed(2);
    console.log("update ", blocks, " fund ", funds);
     //ws.send(JSON.stringify({'blocks':blocks, 'funds':funds}));
     if(funds<2)
      ws.send(get_messageJSON(`I'm running out of NUKO, please help by notifying the devs or donate to me at 0x1ec366337ef2de16a5765700da06bb96a7312845 `));
      wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          //client.send("test broadcast");
           client.send(JSON.stringify({'blocks':blocks, 'funds':funds}));

        }
      });

}
 catch (e) { /*console.log("Error");*/ }
};

wss.on('connection', function (ws) {
  blocks = web3.eth.getBlock("latest").number;
  funds = parseFloat(web3.fromWei(web3.eth.getBalance(bot_address),'ether')).toFixed(2);
  console.log("update ", blocks, " fund ", funds);
   ws.send(JSON.stringify({'blocks':blocks, 'funds':funds}));
   if(funds<2)
    ws.send(get_messageJSON(`I'm running out of NUKO, please help by notifying the devs or donate to me at 0x1ec366337ef2de16a5765700da06bb96a7312845 `));


  ws.on('message', function (message) {
    console.log('received: %s', message)
		var msg_obj = JSON.parse(message);
		var captcha = msg_obj.captcha;
		console.log(msg_obj.url);
		console.log('verifying captcha ', captcha);
		recaptcha.checkResponse(captcha, function(error, response){
        if(error){
            // an internal error?
						try { ws.send(get_messageJSON("Error Recaptcha")); }
							catch (e) { console.log("Error"); }
            return;
        }
        if(response.success){
					try {

							ws.send(get_messageJSON("Passed reCaptcha test"));
							var url_array = msg_obj.url.split("/");
							var tweet_id = url_array[url_array.length -1];
							console.log("tweet id ", tweet_id);
							T.get('statuses/show/:id', { id: tweet_id }, function (err, data, response) {
                if(err){
                  console.log("ERR twitter api");
                  ws.send(get_messageJSON("Error on parsing tweet, make sure you paste the correct twitter link"));
                  return;
                }
							  //console.log(data);
								console.log("created time ",data.created_at);
								console.log("text ", data.text);
								console.log("user ", data.user.screen_name);

								var sender = data.user.screen_name;
								var startTime = moment(data.created_at, "ddd MMM D HH:mm:ss ZZ YYYY");
								var duration = moment.duration(moment().diff(startTime));
								var hours = duration.asHours();
								console.log("created x hours ago: ",hours);
								if ( !(accounts)|| !(accounts[sender])) {
								        accounts[sender] = {lasttx:""};
								        db.addNewUser(sender);
								    }

								const names = [data.user.screen_name];
								const converted_text = data.text.toLowerCase().replace(/ +(?= )/g,'').replace(/(\r\n|\n|\r)/gm," ");;
								const text_tokenize = converted_text.split(" ") ;
								var i = 0;

								if(hours>3){
									ws.send(get_messageJSON("Tweet must be tweeted less than 3 hours ago"));
									console.log("have to return");
									return;
								}

								if(data.text.toLowerCase().indexOf("nekonium") == -1){
									ws.send(get_messageJSON("Tweet must contain #nekonium"));
									console.log("have to return");
									return;
								}
								if(accounts[sender].lasttx !== ""){
									var lasttx_time = moment(accounts[sender].lasttx);
									var tx_duration = moment.duration(moment().diff(lasttx_time));
									var tx_waiting_time = moment.duration(moment().diff(lasttx_time.add(5,'minutes')));
									var tx_minutes = tx_duration.asMinutes();
									console.log("old account ", lasttx_time);
									console.log("time passed (minutes) ", tx_minutes);
									//change to 24*60 in real test
									if(tx_minutes<2){
										console.log("too early return");
										ws.send(get_messageJSON("Last tx time : " + lasttx_time.utc().format()+". You need to wait for : "+ tx_waiting_time.humanize() + " before using the faucet again"));
										return;
									}

								}


								text_tokenize.forEach(function(entry) {
										console.log("entry ",entry);
										if(entry.toLowerCase().substr(0, 2) == '0x'){
											console.log("found ", entry);
											if(entry.toLowerCase().length >35 ){
												var nuko_address = entry.toLowerCase();
												ws.send(get_messageJSON("Tweet's content accepted, waiting for twitter bot detector in ~ 6 seconds"));
												B.getBatchBotScores(names,data => {
													var score = data[0].botometer.scores.universal;
													var content_score = data[0].botometer.categories.content;
													var friend_score = data[0].botometer.categories.friend;
													var network_score = data[0].botometer.categories.network;
													var sentiment_score = data[0].botometer.categories.sentiment;

												  console.log(score, content_score ,friend_score , network_score,sentiment_score);
													if(score && score < 0.7 && content_score< 0.75 && friend_score<0.75 && network_score < 0.75 && sentiment_score<0.75)
													{
														console.log("passed bot check ",nuko_address);
														console.log("sender ",sender);
														//send nuko
														//send_nuko(to, amount, ws, userid)
														send_nuko(nuko_address,1, ws, sender);

													}else {
														ws.send(get_messageJSON("Are you a bot? If not, please add more friends, tweet more. Your account is very suspicious"));
													}

												});
											}

										}

								});




							})




						}
						catch (e) { console.log("Error"); }
        }else{
					try { ws.send("robot"); }
						catch (e) { console.log("Error"); }
            // show warning, render page, return a json, etc.
        }
    });
  });
	ws.on('error', () => console.log('errored'));
});

setInterval(
  () => {
wss.broadcast();
      },
      10000
    );
