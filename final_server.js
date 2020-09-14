var fs = require('fs');
const tf = require('@tensorflow/tfjs');
const tfnode = require('@tensorflow/tfjs-node');
const { performance } = require('perf_hooks');
var path = require('path');

function domain_length(domain) {
  return domain.length;
}

function consecutive_character(domain) {
  var pattern = /([a-zA-Z\-])\1{1,}/gi;
  var result = domain.match(pattern);
  var number = []
  if(result != null) {
    for(let i = 0; i < result.length; i++) {
      number.push(result[i].length);
    }
    var max_number = Math.max.apply(null, number)
    //console.log(max_number);
    return max_number;
  }
  return 1;
}

//各文字の出現回数
function counter(domain) {
  var distinct_char = [];
  var char = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-\.".split("");
  for(let i = 0; i < char.length; i++) {
    var number = domain.split(char[i]).length - 1
    if(number > 0) {
      //console.log(`${char[i]} ${number}`);
      distinct_char.push(number);
    }
  }
  return distinct_char;
}

function domain_entropy(domain) {
  var number_char = counter(domain); //domain中各文字の出現回数配列
  var length = domain_length(domain); //domainの文字長(ピリオドを含む)
  var entropy = 0;
  for(let i = 0; i < number_char.length; i++) {
    var p = number_char[i] / length;
    var lb = Math.LOG2E * Math.log(p);
    entropy += p * lb;
  }
  return 0 - entropy;
}

var exec = require('child_process').exec;
async function exec_shell(cmd) {
  return new Promise(function (resolve, reject) {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function get_IP(domain, server) {
  var ip_list = []
  for(const svr of server) {
    //console.log(`DNS : ${svr} (${domain})`);
    var { stdout } = await exec_shell(`nslookup -debug ${domain} ${svr} | grep "internet address"`);
    var line = stdout.split('\n');
    //console.log(`ip : ${line} (${domain})`);
    for(let i = 0; i < line.length - 1; i++) {
      var ip = line[i].split(' ').slice(-1)[0];
      if(!ip_list.includes(ip)) {
        //console.log(`ip: ${ip} (${domain})`);
        ip_list.push(ip);
      }
    }
  }
  return { length: ip_list.length, country: await IP_country(ip_list) };
}

async function IP_country(ip_list) {
  var country_list = [];
  for(const ip of ip_list) {
    //console.log(`ip : ${ip}`);
    var { stdout } = await exec_shell(`whois ${ip} | grep -i country`);
    var line = stdout.split('\n');
    //console.log(`country : ${line} (${ip})`);
    for(let i = 0; i < line.length - 1; i++) {
      var country = line[i].split(' ').slice(-1)[0];
      //console.log(`country: ${country} (${ip})`);
      if (!country_list.includes(country)) {
        country_list.push(country);
      }
    }
  }
  return country_list.length;
}

async function get_TTL(domain, server) {
  var ttl_list = [];
  for(const svr of server) {
    //console.log(`DNS : ${svr} (${domain})`);
    var { stdout } = await exec_shell(`nslookup -debug ${domain} ${svr} | grep ttl`);
    var line = stdout.split('\n');
    //console.log(`ttl : ${line} (${domain})`);
    for(let i = 0; i < line.length - 1; i++) {
      var ttl = line[i].split(' ').slice(-1)[0];
      //console.log(`ttl: ${ttl} (${domain})`);
      if(!ttl_list.includes(ttl)) {
        ttl_list.push(ttl);
      }
    }
  }
  var sum = 0;
  for(let i = 0; i < ttl_list.length; i++) {
    sum += Number(ttl_list[i]);
  }
  const average = sum / ttl_list.length;
  var sum_difference = 0;
  for(let i = 0; i < ttl_list.length; i++) {
    let difference = ttl_list[i] - average;
    //console.log(`difference: ${difference} (${domain})`);
    sum_difference += difference ** 2;
    //console.log(`sum_difference: ${sum_difference} (${domain})`);
  }
  const standard_deviation = Math.sqrt(sum_difference / ttl_list.length);
  return { avg: average, std: standard_deviation };
}

async function get_expiration(domain) {
  var date_list = []
  var { stdout } = await exec_shell(`whois ${domain} | grep -ie "expiry date" -ie "expiration date" -e "有効期限"`);
  var line = stdout.split('\n');
  //console.log(stdout);
  for(var i = 0; i < line.length - 1; i++) {
    var date = [];
    var tmp_date = line[i].split(' ').slice(-1)[0].split('-');
    if(tmp_date.length > 1) {
      for(let j = 0; j < 3; j++) {
        date.push(tmp_date[j]);
      }
      date[date.length - 1] = date[date.length - 1].split('T')[0];
      //console.log(`(English) updated date : ${date} (${domain})`);
    } else {
      tmp_date = [];
      for(let j = 0; j < 3; j++) {
        tmp_date.push(line[i].split(' ').slice(-3)[j]);
      }
      if(tmp_date[0] == '') {
        date = tmp_date.slice(-1)[0].split('/');
      } else {
        date = tmp_date[0].split('/');
      }
      date[date.length - 1] = date[date.length - 1];
      //console.log(`(Japanese) updated date : ${date} (${domain})`);
    }
    console.log(date);
    if (date.length == 3){
     let date_time = new Date(date);
     date_list.push(date_time);
    }
    //let date_time = new Date(date);
    //console.log(`date of expiration date : ${date_time.getFullYear()}-${date_time.getMonth()+1}-${date_time.getDate()}`);
    //date_list.push(date_time);
  }
  return date_list[date_list.length - 1];
}

async function get_created(domain) {
  var date_list = []
  var { stdout } = await exec_shell(`whois ${domain} | grep -ie "creation date" -e "登録年月日"`);
  var line = stdout.split('\n');
  //console.log(`line of created date : ${line}`);
  for(var i = 0; i < line.length - 1; i++) {
    var date = [];
    var tmp_date = line[i].split(' ').slice(-1)[0].split('-');
    if(tmp_date.length > 1) {
      for(let j = 0; j < 3; j++) {
        date.push(tmp_date[j]);
      }
      date[date.length - 1] = date[date.length - 1].split('T')[0];
      //console.log(`(English) updated date : ${date} (${domain})`);
    } else {
      tmp_date = [];
      for(let j = 0; j < 3; j++) {
        tmp_date.push(line[i].split(' ').slice(-3)[j]);
      }
      if(tmp_date[0] == '') {
        date = tmp_date.slice(-1)[0].split('/');
      } else {
        date = tmp_date[0].split('/');
      }
      date[date.length - 1] = date[date.length - 1];
      //console.log(`(Japanese) updated date : ${date} (${domain})`);
    }
    let date_time = new Date(date);
    //console.log(`date of created date : ${date_time.getFullYear()}-${date_time.getMonth()+1}-${date_time.getDate()}`);
    date_list.push(date_time);
  }
  return date_list[date_list.length - 1];
}

async function get_updated(domain) {
  var date_list = []
  var { stdout } = await exec_shell(`whois ${domain} | grep -ie "updated date" -e "最終更新"`);
  var line = stdout.split('\n');
  //console.log(`line of updated date : ${line} (${domain})`);
  for(var i = 0; i < line.length - 1; i++) {
    var date = [];
    var tmp_date = line[i].split(' ').slice(-1)[0].split('-');
    if(tmp_date.length > 1) {
      for(let j = 0; j < 3; j++) {
        date.push(tmp_date[j]);
      }
      date[date.length - 1] = date[date.length - 1].split('T')[0];
      //console.log(`(English) updated date : ${date} (${domain})`);
    } else {
      tmp_date = line[i].split(' ').slice(-3)[0];
      date = tmp_date.split('/');
      date[date.length - 1] = date[date.length - 1];
      //console.log(`(Japanese) updated date : ${date}`);
    }
    let date_time = new Date(date);
    //console.log(`date of updated date : ${date_time.getFullYear()}-${date_time.getMonth()+1}-${date_time.getDate()}`);
    date_list.push(date_time);
  }
  return date_list[date_list.length - 1];
}

async function date_difference(domain) {
  const expiration = await get_expiration(domain);
  const created = await get_created(domain);
  const updated = await get_updated(domain);
  console.log(expiration)
  console.log(created)
  var life_time = (expiration - created) / 86400000;
  var active_time = (updated - created) / 86400000;
  return { life: life_time, active: active_time };
}

//ここからメイン


async function get_features(domain){
  result_list = [];
  var server=["1.1.1.1", "8.8.8.8", "208.67.222.123", "176.103.130.130", "64.6.64.6"]
  start_time = performance.now();
  // let { length, country } = await get_IP(domain, server);
  // let { avg, std } = await get_TTL(domain, server);
  // let { life, active } = await date_difference(domain);

  f = await Promise.all([get_IP(domain, server),get_TTL(domain, server),date_difference(domain)])
  //console.log(f);
  result_list.push(domain_length(domain));
  result_list.push(consecutive_character(domain));
  result_list.push(domain_entropy(domain));
  result_list.push(f[0]["length"]);
  result_list.push(f[0]["country"]);
  result_list.push(f[1]["avg"]);
  result_list.push(f[1]["std"]);
  result_list.push(f[2]["life"]);
  result_list.push(f[2]["active"]);
  end_time = performance.now();
  console.log(end_time-start_time)
  // console.log(`Average TTL Value: ${avg} (${domain})`);
  // console.log(`Standard Deviation of TTL: ${std} (${domain})`);
  // console.log(`Number of IP addresses: ${length} (${domain})`);
  // console.log(`Number of Countries: ${country} (${domain})`);
  // console.log(`Life Time of Domain: ${life} (${domain})`);
  // console.log(`Active Time of Domain: ${active} (${domain})\n`);
  return result_list
}


function indexOfMax(arr) {
    if (arr.length === 0) {
        return -1;
    }

    var max = arr[0];
    var maxIndex = 0;

    for (var i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
            maxIndex = i;
            max = arr[i];
        }
    }

    return maxIndex;
}

async function inference(path,features){
  const tf_features = tf.tensor(features);
  model = await tf.loadLayersModel(path);
  model.compile({optimizer: 'sgd', loss: 'meanSquaredError'});
  y_pred = await model.predict(tf_features);
  y_pred.print();
  //result = y_pred.argMax(0);
  //console.log(result);
  const values = await y_pred.data();
  const arr = await Array.from(values);
  result = indexOfMax(arr);
  console.log(result);  
if (result == 0){
    console.log("Benign");
  } else{
    console.log("Malware");
  }
  return result
}
// app.get('/model_iris', (req, res) => {
//   var options = {
//     root: path.join(__dirname, 'model_iris'),
//     dotfiles: 'deny',
//     headers: {
//       'x-timestamp': Date.now(),
//       'x-sent': true
//     }
//   }
//   var url = req.url
//   var fileName = path.join(__dirname,req.url)
//   console.log(fileName)
//   res.sendFile(fileName,options);
// });
async function standard_trans(features,parameter_path){
  const jsonObject = JSON.parse(fs.readFileSync(parameter_path, 'utf8'));
  console.log(jsonObject);
  console.log(features);
  const keys = Object.keys(jsonObject);
  for (let i=0; i < keys.length; i++) {
    let f_value = features[i];
    let key = keys[i];
    let val = jsonObject[key];
    features[i] = (f_value - val[0])/val[1];
  }
  console.log(features);
  return features
}

async function Ouralgorithm(domain){
  path = "file:///root/http_server/model_mws/model.json";
  parameter_path = __dirname + "/model_mws/parameter.json";
  features = await get_features(domain);
  standard_trans(features,parameter_path);
  console.log(features);
  result = inference(path,[features]);
  console.log(result);
  return result
}

var http = require('http');
var html = require('fs').readFileSync('index.html');

http.createServer(function(req, res) {

  if(req.method === 'GET') {
    res.writeHead(200, {'Content-Type' : 'text/html'});
    res.end(html);
  }else if(req.method === 'POST') { // POST受信処理
     console.log("rcv POST request");
     var data = '';

   //POSTデータを受けとる
   req.on('data', function(chunk) {data += chunk})
      .on('end', async function() {

         console.log(data);//ドメイン

	result = await Ouralgorithm(data);
        console.log(result);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.end(String(result));//推測結果
        //res.setAttribute('result', '12');

      })
  }

}).listen(4000);
