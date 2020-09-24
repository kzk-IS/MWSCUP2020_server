const { execSync } = require('child_process');
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

async function get_nslookup(domain, server) {
  var ip_list = [];
  var ttl_list = [];
  for(const svr of server) {
    try {
      const stdout = execSync(`nslookup -debug ${domain} ${svr}`);
      var line = stdout.toString().split('\n');
      //console.log(line);
      ip_list = get_IP(line, ip_list);
      //console.log(ip_list);
      ttl_list = get_TTL(line, ttl_list);
    } catch (error) {
      //console.log(`error`);
    }
  }
  var length = ip_list.length;
  var country = await IP_country(ip_list);
  var { avg, std } = calculate_ttl(ttl_list);
  return { length: length, country: country, avg: avg, std: std }
}

function get_IP(line, iplist) {
  var pattern = /(internet address)/gi;
  var match_line = [];
  for(let i = 0; i < line.length; i++) {
    var result = pattern.exec(line[i]);
    if(result != null) {
      match_line.push(result.input);
    }
  }
  //console.log(match_line);

  for(let i = 0; i < match_line.length; i++) {
    var ip = match_line[i].split(' ').slice(-1)[0];
    if(!iplist.includes(ip)) {
      //console.log(`ip: ${ip} (${domain})`);
      iplist.push(ip);
    }
  }
  return iplist;
}

async function IP_country(iplist) {
  var whois_list = [];
  for(const ip of iplist) {
    try {
      const stdout = execSync(`whois ${ip}`);
      var line = stdout.toString().split('\n');
      whois_list.push(line);
    } catch (error) {
      //console.log(`error`);
    }
  }

  var match_line = [];
  var pattern = /(country)/i;
  for(let i = 0; i < whois_list.length; i++) {
    var whois_line = whois_list[i];
    for(let j = 0; j < whois_line.length; j++) {
      var result = whois_line[j].match(pattern);
      if(result != null) {
        match_line.push(result.input);
        break;
      }
    }
  }
  //console.log(match_line);

  var countrylist = [];
  for(let i = 0; i < match_line.length; i++) {
    var country = match_line[i].split(' ').slice(-1)[0];
    //console.log(`country: ${country} (${ip})`);
    if (!countrylist.includes(country)) {
      countrylist.push(country);
    }
  }
  return countrylist.length;
}

function get_TTL(line, ttllist) {
  var pattern = /(ttl )/gi;
  var match_line = [];
  for(let i = 0; i < line.length; i++) {
    var result = pattern.exec(line[i]);
    if(result != null) {
      match_line.push(result.input);
    }
  }
  //console.log(match_line);

  for(let i = 0; i < match_line.length; i++) {
    var ttl = match_line[i].split(' ').slice(-1)[0];
    //console.log(`ttl: ${ttl} (${domain})`);
    if(!ttllist.includes(ttl)) {
      ttllist.push(ttl);
    }
  }
  return ttllist;
}

function calculate_ttl(ttllist) {
  //console.log(ttllist)
  if(ttllist.length == 0) {
    return { avg: 0, std: 0 };
  }

  var sum = 0;
  for(let i = 0; i < ttllist.length; i++) {
    sum += Number(ttllist[i]);
  }
  var average = sum / ttllist.length;
  var sum_difference = 0;
  for(let i = 0; i < ttllist.length; i++) {
    let difference = ttllist[i] - average;
    //console.log(`difference: ${difference} (${domain})`);
    sum_difference += difference ** 2;
    //console.log(`sum_difference: ${sum_difference} (${domain})`);
  }
  var standard_deviation = Math.sqrt(sum_difference / ttllist.length);
  return { avg: average, std: standard_deviation };
}

function get_expiration(line, parent_domain) {
  var date_time;
  if(parent_domain == 'jp') { // 日本語
    let pattern = /(有効期限)|(状態)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let tmp_date = match_line[0].split(' ');
      if(tmp_date[0] == '[有効期限]') {
        date = tmp_date.slice(-1)[0].split('/');
      } else if(match_line.length > 1) {
        let tmp_date2 = match_line[1].split(' ');
        if(tmp_date2[0] == '[有効期限]') {
          date = tmp_date2.slice(-1)[0].split('/');
        }
      } else {
        date = tmp_date.slice(-1)[0].substr(1,10).split('/');
      }
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'uk' || parent_domain == 'edu' || parent_domain == 'uz' || parent_domain == 'dk' || parent_domain == 'tr' || parent_domain == 'mx' || parent_domain == 'it' || parent_domain == 'ee' || parent_domain == 'dz' || parent_domain == 'ir' || parent_domain == 'ro' || parent_domain == 'se' || parent_domain == 'by' || parent_domain == 'lt' || parent_domain == 'ug' || parent_domain == 'md' || parent_domain == 'xn--90ais' || parent_domain == 'ie' || parent_domain == 'sk' || parent_domain == 'nu') { //後ろから1つ目
    let pattern = /(Renewal date:)|(Expiry date:)|(Domain expires:)|(Expires on\.\.\.)|(Expiration Date:)|(Expire Date:)|(expire:)|(EXPIRES:)|(expire-date:)|(Expires On:)|(Valid Until:)/i;
    let match_line = [];
    let line_number = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
        line_number.push(i);
      }
    }
    //console.log(match_line);
    //console.log(line_number);

    if(match_line.length > 0) {
      let tmp_date = match_line[0].split(' ').slice(-1)[0];
      let date;
      if(tmp_date == 'date:') {
        date = line[line_number[0]+1].split(' ').slice(-3);
        date[0] = date[0].split('th')[0].split('st')[0];
      } else {
        date = tmp_date;
      }
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'br') { //後ろから1つ目 YYYYMMDD
    let pattern = /(expires:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let tmp_date = match_line[0].split(' ').slice(-1)[0];
      let date = [];
      date[0] = tmp_date.substr(0, 4);
      date[1] = tmp_date.substr(4, 2);
      date[2] = tmp_date.substr(6, 2);
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'cn' || parent_domain == 'tw' || parent_domain == 'ua' || parent_domain == 'ar' || parent_domain == 'ly') { //後ろから2つ目
    let pattern = /(Expiration Time:)|(Record expires on)|(expires:)|(expire:)|(Expired:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-2)[0];
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'id' || parent_domain == 'sg') { //後ろから2つ目 名前:日付
    let pattern = /(Expiration Date:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-2)[0].split(':')[1].split('-');
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'pl' || parent_domain == 'cl') { //後ろから3つ目
    let pattern = /(renewal date:)|(Expiration Date:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-3)[0];
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'kr' || parent_domain == 'th') { //後ろから1つ目 空欄区切り
    let pattern = /(Expiration Date)|(Exp date:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-3);
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'cz' || parent_domain == 've' || parent_domain == 'tz') { //後ろから1つ目 逆転(.)
    let pattern = /(expire:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-1)[0].split('.').reverse();
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'pt' || parent_domain == 'im') { //後ろから2つ目 逆転(/)
    let pattern = /(Expiration Date:)|(Expiry Date:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-2)[0].split('/').reverse();
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'fi' || parent_domain == 'rs') { //後ろから2つ目 逆転(.)
    let pattern = /(expires\.\.\.)|(Expiration date:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-2)[0].split('.').reverse();
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'hk') { //後ろから2つ目 逆転(-)
    let pattern = /(Expiry Date:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-2)[0].split('-').reverse();
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }

  } else { //com, org, net, io, ru, gle, fr, me, in, tv, ca, ms, news, co, wiki, us, page, gl, goog, info, la, cc, google, blog, ma, gd, site, icu, top, online, su, capital, xyz, club, link, ng, hr, kiwi, ltd, shop, ws, hn, tech, pro, moe, mn, world, xn--p1ai, today, app, pw, red, ke
    let pattern = /(Expiry date:)|(paid-till:)|(Expiration Date:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-1)[0].split('-');
      date[2] = date[2].split('T')[0];
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  }
  return date_time;
}

function get_created(line, parent_domain) {
  var date_time;
  if(parent_domain == 'jp') { // 日本語
    let pattern = /(登録年月日)|(接続年月日)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-1)[0].split('/');
      date[date.length - 1] = date.slice(-1)[0].replace(/\r/g,"");
      if(date == '') {
        // 接続年月日: YYYY/MM/DD
        let setsuzoku = match_line[1].split(' ');
        if(setsuzoku[0] == '[接続年月日]') {
          date = setsuzoku.slice(-1)[0].split('/');
          //console.log(date);
          var date_time = new Date(date);
          //console.log(date_time);
        }
      } else {
        //console.log(date);
        date_time = new Date(date);
        //console.log(date_time);
      }
    }
  } else if(parent_domain == 'uk' || parent_domain == 'edu' || parent_domain == 'uz' || parent_domain == 'dk' || parent_domain == 'tr' || parent_domain == 'mx' || parent_domain == 'dz' || parent_domain == 'nl' || parent_domain == 'ro' || parent_domain == 'se' || parent_domain == 'by' || parent_domain == 'lt' || parent_domain == 'ug' || parent_domain == 'md' || parent_domain == 'no' || parent_domain == 'xn--90ais' || parent_domain == 'ie' || parent_domain == 'sk' || parent_domain == 'nu') { //後ろから1つ目
    let pattern = /(Creation Date:)|(Registered:)|(created:)|(Registered On:)|(Created On:)|(Created on\.\.\.)|(Domain record activated:)|(Entry created:)|(Registration Date:)/i;
    let match_line = [];
    let line_number = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
        line_number.push(i);
      }
    }
    //console.log(match_line);
    //console.log(line_number);

    if(match_line.length > 0) {
      let tmp_date = match_line[0].split(' ');
      let date;
      if(tmp_date[0] == 'Entry') {
        date = line[line_number[0]+1].split(' ').slice(-3);
        date[0] = date[0].split('th')[0].split('st')[0];
      } else if(match_line.length > 1) {
        date = match_line[1].split(' ').slice(-1)[0];
      }
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'cn' || parent_domain == 'tw' || parent_domain == 'it' || parent_domain == 'ua' || parent_domain == 'ar' || parent_domain == 'hu' || parent_domain == 'ly') { //後ろから2つ目
    let pattern = /(registered:)|(created:)|(Record created on)|(Registration Time:)|(record created:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 1) {
      let date = match_line[1].split(' ').slice(-2)[0];
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'br') { //後ろから2つ目 YYYYMMDD
    let pattern = /(created:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 1) {
      let tmp_date = match_line[1].split(' ').slice(-2)[0];
      let date = [];
      date[0] = tmp_date.substr(0, 4);
      date[1] = tmp_date.substr(4, 2);
      date[2] = tmp_date.substr(6, 2);
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'id' || parent_domain == 'sg') { //後ろから2つ目 名前:日付
    let pattern = /(Creation Date:)|(Created On:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-2)[0].split(':')[1].split('-');
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'pl' || parent_domain == 'cl' || parent_domain == 'ee' || parent_domain == 'kz') { //後ろから3つ目
    let pattern = /(registered:)|(Creation date:)|(created:)|(Domain created:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 1) {
      let date = match_line[1].split(' ').slice(-3)[0];
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'kr' || parent_domain == 'th' || parent_domain == 'be') { //後ろから1つ目 空欄区切り
    let pattern = /(Created date:)|(Registered Date)|(Registered:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-3);
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'gg') { //後ろから1つ目 空欄区切り DDth
    let pattern = /(Registered on)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let tmp_date = match_line[0].split(' ').slice(-3);
      let date = [];
      for(let i = 0; i < 3; i++) {
        date.push(tmp_date[i].split('th')[0]);
      }
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'hk') { //後ろから1つ目 逆転(-)
    let pattern = /(Domain Name Commencement Date:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-1)[0].split('-').reverse();
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'pt') { //後ろから2つ目 逆転(/)
    let pattern = /(Creation Date:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-2)[0].split('/').reverse();
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'cz' || parent_domain == 've' || parent_domain == 'tz' || parent_domain == 'fi' || parent_domain == 'rs') { //後ろから2つ目 逆転(.)
    let pattern = /(created\.\.\.)|(registered:)|(Registration date:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-2)[0].split('.').reverse();
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'int') { //IANA
    let pattern = /(created:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-1)[0].split('-');
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else { //com, org, net, io, ru, gle, fr, me, in, tv, ca, ms, news, co, nz, wiki, us, page, gl, goog, info, la, cc, google, blog, ma, gd, site, icu, top, online, su, capital, xyz, club, link, ng, hr, kiwi, ltd, shop, ws, hn, tech, pro, moe, mn, world, xn--p1ai, today, app, nz, pw, red, ke
    let pattern = /(domain_dateregistered:)|(domain_datecreated:)|(Creation Date:)|(created:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 1) {
      let date = match_line[1].split(' ').slice(-1)[0].split('-');
      date[2] = date[2].split('T')[0];
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  }
  return date_time;
}

function get_updated(line, parent_domain) {
  var date_time;
  if(parent_domain == 'jp') { // 日本語
    let pattern = /(最終更新)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let tmp_date = match_line[0].split(' ').slice(-3);
      let date;
      if(tmp_date[0] == '') {
        date = tmp_date[2].split('/');
      } else {
        date = tmp_date[0].split('/');
      }
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'uk' || parent_domain == 'edu' || parent_domain == 'uz' || parent_domain == 'mx' || parent_domain == 'nl' || parent_domain == 'ir' || parent_domain == 'se' || parent_domain == 'by' || parent_domain == 'ug' || parent_domain == 'no' || parent_domain == 'xn--90ais' || parent_domain == 'sk' || parent_domain == 'nu') { //後ろから1つ目
    let pattern = /(Updated Date:)|(modified:)|(Last Updated On:)|(Domain record last updated:)|(Entry updated:)|(Last updated:)|(Updated:)/i;
    let match_line = [];
    let line_number = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
        line_number.push(i);
      }
    }
    //console.log(match_line);
    //console.log(line_number);

    if(match_line.length > 0) {
      let tmp_date = match_line[0].split(' ');
      let date;
      if(tmp_date[0] == 'Entry') {
        date = line[line_number[0]+1].split(' ').slice(-3);
        date[0] = date[0].split('th')[0].split('st')[0];
      } else {
        date = tmp_date.slice(-1)[0];
      }
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'br') { //後ろから1つ目 YYYYMMDD
    let pattern = /(changed:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 1) {
      let tmp_date = match_line[1].split(' ').slice(-1)[0];
      let date = [];
      date[0] = tmp_date.substr(0, 4);
      date[1] = tmp_date.substr(4, 2);
      date[2] = tmp_date.substr(6, 2);
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'it' || parent_domain == 'ua' || parent_domain == 'ar' || parent_domain == 'ly') { //後ろから2つ目
    let pattern = /(changed:)|(modified:)|(Last Update:)|(Updated:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 1) {
      let date = match_line[1].split(' ').slice(-2)[0];
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'at' || parent_domain == 'il') { //後ろから2つ目 YYYYMMDD
    let pattern = /(changed:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 1) {
      let tmp_date = match_line[1].split(' ').slice(-2)[0];
      let date = [];
      date[0] = tmp_date.substr(0, 4);
      date[1] = tmp_date.substr(4, 2);
      date[2] = tmp_date.substr(6, 2);
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'id' || parent_domain == 'sg') { //後ろから2つ目 名前:日付
    let pattern = /(Modified Date:)|(Last Updated On:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-2)[0].split(':')[1].split('-');
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'pl' || parent_domain == 'ee' || parent_domain == 'kz') { //後ろから3つ目
    let pattern = /(changed:)|(last modified)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 1) {
      let date = match_line[1].split(' ').slice(-3)[0];
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'kr' || parent_domain == 'th') { //後ろから1つ目 空欄区切り
    let pattern = /(Updated date:)|(Last Updated Date)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-3);
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'fi') { //後ろから1つ目 逆転(.)
    let pattern = /(modified\.\.\.)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-1)[0].split('.').reverse();
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'cz' || parent_domain == 've' || parent_domain == 'tz' || parent_domain == 'rs') { //後ろから2つ目 逆転(.)
    let pattern = /(changed:)|(Modification date:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 1) {
      let date = match_line[1].split(' ').slice(-2)[0].split('.').reverse();
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else if(parent_domain == 'int') { //IANA
    let pattern = /(changed:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 0) {
      let date = match_line[0].split(' ').slice(-1)[0].split('-');
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  } else { //com, org, net, io, de, gle, fr, me, au, in, tv, ca, ms, news, co, nz, wiki, us, page, gl, goog, info, la, cc, google, blog, ma, gd, site, icu, top, online, capital, xyz, club, link, ng, hr, kiwi, ltd, shop, ws, hn, tech, pro, moe, mn, world, today, app, nz, pw, red, ke
    let pattern = /(Last Modified:)|(domain_datelastmodified:)|(Updated Date:)|(last-update:)|(Changed:)/i;
    let match_line = [];
    for(let i = 0; i < line.length; i++) {
      let result = pattern.exec(line[i]);
      if(result != null) {
        match_line.push(result.input);
      }
    }
    //console.log(match_line);

    if(match_line.length > 1) {
      let date = match_line[1].split(' ').slice(-1)[0].split('-');
      date[2] = date[2].split('T')[0];
      //console.log(date);
      date_time = new Date(date);
      //console.log(date_time);
    }
  }
  return date_time;
}


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

async function date_difference(domain) {
  var parent_domain = domain.split('.').slice(-1)[0];
  //console.log(parent_domain);
  try {
    const stdout = execSync(`whois ${domain}`);
    var line = stdout.toString().split('\n');
    var expiration = get_expiration(line, parent_domain);
    var created = get_created(line, parent_domain);
    var updated = get_updated(line, parent_domain);
  } catch (error) {
    //console.log(`error`);
  }
  //console.log(expiration, created, updated);
  if(created == undefined || expiration == undefined) {
    var life_time = 0;
  } else if(created == ('Invalid Date') || expiration == 'Invalid Date') {
    var life_time = 0;
  } else {
    var life_time = (expiration - created) / 86400000;
  }
  if(updated == undefined || created == undefined) {
    var active_time = 0;
  } else if(updated == ('Invalid Date') || created == 'Invalid Date') {
    var active_time = 0;
  } else {
    var active_time = (updated - created) / 86400000;
  }
  return { life: life_time, active: active_time };
}

/**
ここからメイン
**/


async function get_features(domain){
  result_list = [];
  var server=["1.1.1.1", "8.8.8.8", "208.67.222.123", "176.103.130.130", "64.6.64.6"]
  start_time = performance.now();
  // let { length, country } = await get_IP(domain, server);
  // let { avg, std } = await get_TTL(domain, server);
  // let { life, active } = await date_difference(domain);

  f = await Promise.all([get_nslookup(domain,server),date_difference(domain)])
  //console.log(f);
  result_list.push(domain_length(domain));
  result_list.push(consecutive_character(domain));
  result_list.push(domain_entropy(domain));
  result_list.push(f[0]["length"]);
  result_list.push(f[0]["country"]);
  result_list.push(f[0]["avg"]);
  result_list.push(f[0]["std"]);
  result_list.push(f[1]["life"]);
  result_list.push(f[1]["active"]);
  end_time = performance.now();
  console.log(end_time-start_time)
  console.log(result_list)
  // console.log(`Average TTL Value: ${avg} (${domain})`);
  // console.log(`Standard Deviation of TTL: ${std} (${domain})`);
  // console.log(`Number of IP addresses: ${length} (${domain})`);
  // console.log(`Number of Countries: ${country} (${domain})`);
  // console.log(`Life Time of Domain: ${life} (${domain})`);
  // console.log(`Active Time of Domain: ${active} (${domain})\n`);
  return result_list
}

async function get_feature(domain, isMalicious) {
  var server = ["1.1.1.1", "8.8.8.8", "208.67.222.123", "176.103.130.130", "64.6.64.6"];
  console.log(domain);
  let dlength = domain_length(domain);
  let consecutive = consecutive_character(domain);
  let entropy = domain_entropy(domain);
  let { length: length, country: country, avg: avg, std: std } = await get_nslookup(domain, server);
  let { life, active } = await date_difference(domain);

  var features = { isMaliciousSite:isMalicious, domainLength:dlength,
    consecutive:consecutive, entropy:entropy, IPaddress:length ,
    countries:country , averageTTL:avg , stdTTL:std , lifeTime:life , activeTime:active };
  return features;
}

/**
main関数呼び出し
**/

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
  //console.log(result);
if (result == 0){
    console.log("Benign");
  } else{
    console.log("Malware");
  }
  return result
}

async function date_difference(domain) {
  var parent_domain = domain.split('.').slice(-1)[0];
  //console.log(parent_domain);
  try {
    const stdout = execSync(`whois ${domain}`);
    var line = stdout.toString().split('\n');
    var expiration = get_expiration(line, parent_domain);
    var created = get_created(line, parent_domain);
    var updated = get_updated(line, parent_domain);
  } catch (error) {
    //console.log(`error`);
  }
  //console.log(expiration, created, updated);
  if(created == undefined || expiration == undefined) {
    var life_time = 0;
  } else if(created == ('Invalid Date') || expiration == 'Invalid Date') {
    var life_time = 0;
  } else {
    var life_time = (expiration - created) / 86400000;
  }
  if(updated == undefined || created == undefined) {
    var active_time = 0;
  } else if(updated == ('Invalid Date') || created == 'Invalid Date') {
    var active_time = 0;
  } else {
    var active_time = (updated - created) / 86400000;
  }
  return { life: life_time, active: active_time };
}


async function Ouralgorithm(domain){
  path = "file://model_mws/model.json";
  parameter_path = __dirname + "/model_mws/parameter.json";
  features = await get_features(domain);
  standard_trans(features,parameter_path);
  console.log(features);
  result = inference(path,[features]);
  //console.log(result);
  return result
}

var http = require('http');
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
