const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const {read, write, update} = require('./secure-fs');
const signature = require('./verify-sig');

const {
  PORT = 3000,
  SLACK_SIGNING_SECRET,
  TEAM_ID,
  TEAM_DOMAIN
} = process.env;

const app = express();
app.use(bodyParser.urlencoded({verify: rawBodyBuffer, extended: true }));
app.use(bodyParser.json({ verify: rawBodyBuffer }));
app.listen(PORT, function(){
  console.log(`We have started our server on port ${PORT}`);
});

app.post('/', async function(req,res){
  if (!validate(req)) {
    res.sendStatus(401)
    return;
  }
  if(!signature.isVerified(req)) {
    res.sendStatus(403);
    return;
  }

  const channel = req.body.channel_id;
  const dataFilePath = path.join(__dirname, channel);
  const result = /(?<action>\w+)\s?(?<args>.*)/u.exec(req.body.text)
  const {action, args} = result.groups;

  switch(action) {
    case 'clear':
      await clear(dataFilePath);
      send(res, 'cleared');
      return;
    case 'add':
      if (!args.trim().length) {
        send(res, 'nothing to add');
        return;
      };
      await add(args, dataFilePath);
      send(res, 'added');
      break;
    case 'remove':
      if (!args.trim().length) {
        send(res, 'nothing to remove');
        return;
      }
      await remove(args, dataFilePath);
      send(res, 'removed');
      break;
    case 'list':
      const seed = getSeeds().weeks;
      const group = await get(dataFilePath);
      let text = ''
      if (group.length < 2) {
        text = 'not enough members';
      } else {
        const markup = ['quiet', 'silent', '-q', '-s'].includes(args.trim()) ?
          (i => i) :
          (member => member ? `<${member}>` : member)
        text = pairs(group, seed)
          .map(pair => pair
             .map(markup)
             .join(' ⟺ '))
          .join('\n');
      }
      send(res, text);
      break;
    default:
      send(res, 'unknown action');
      return;
  }
});

function rawBodyBuffer(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}

function validate(req) {
  if (req.body.team_domain !== TEAM_DOMAIN) return;
  if (req.body.team_id !== TEAM_ID) return;
  if (!req.body.channel_id) return;
  return true;
}

function send(res, text) {
  res.json({response_type: 'in_channel', text})
}

// region: "db" functions
function clear(filePath) {
  return write(filePath, '');
}

async function remove(str, filePath) {
  const list = str.match(/@[^@]+/g).map(s => s.trim());
  const group = await get(filePath);
  const newGroup = group.filter(existing => !list.includes(existing))
  return write(filePath, `${newGroup.join('\n')}\n`);
}

async function get(filePath) {
  const file = await read(filePath);
  return file.split('\n').filter(i => i);
}

function add(str, filePath) {
  const list = str.match(/@[^@]+/g).map(s => s.trim()).join('\n');
  return update(filePath, `${list}\n`);
}
// end region

function getSeeds(dateStr = new Date().toISOString()) {
  const hourResolution = dateStr.replace(/:.+/, ':00:00.000Z');
  const date = Date.parse(hourResolution);
  const base = Date.parse('2017-01-01T00:00:00.000Z'); // Sunday
  const hours = ((date - base) / (1000 * 60 * 60)) | 0;
  const days = (hours / 24) | 0;
  const weeks = (days / 7) | 0;
  return { hours, days, weeks }; // future: let channel/command choose seed to use
}

function pairs(group, seed) {
  const set = new Set(group.sort()); // remove dupes and sort
  const normalizedGroup = Array.from(set);
  const order = [];
  while (normalizedGroup.length) {
    // push 1 at a time, adjusting the modulo until we use every member
    order.push(...normalizedGroup.splice(seed % normalizedGroup.length, 1));
  }
  return order.reduce((pairs, n, i) => {
    if (i % 2 || i === order.length - 1) {
      pairs[pairs.length - 1].push(n);
    } else {
      pairs.push([n]);
    }
    return pairs;
  }, []);
}