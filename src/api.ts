import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const defaultHeaders = {
  'Authorization': `Bearer ${process.env['FACEIT_API_KEY']}`
};

export const app = express();

app.use(cors({ origin: true }));

app.use(express.json());
app.use(express.raw({ type: 'application/vnd.custom-type' }));
app.use(express.text({ type: 'text/html' }));

// Healthcheck endpoint
app.get('/', (req, res) => {
  res.status(200).send({ status: 'ok' });
});

const api = express.Router();

api.get('/hello', (req, res) => {
  res.status(200).send({ message: 'hello world' });
});

api.get('/elo/:username', async (req, res) => {
  const username = req.params['username'];
  const elo = await getCs2PlayerElo(username);
  res.status(200).send({ elo: elo });

});

api.get('/last20/:username', async (req, res) => {
  const username = req.params['username'];
  const playerId = await getPlayerId(username);
  console.log(playerId);
  const stats = await getLast20GamesCs2Stats(playerId);
  res.status(200).send(stats);
});

// Version the api
app.use('/api/v1', api);

async function getCs2PlayerElo(username) {
  const res = await axios.get('https://open.faceit.com/data/v4/players', {
    params: { nickname: username },
    headers: defaultHeaders
  });
  console.log(res.status);
  console.log(res.data);
  if (res.status >= 300 && res.status < 200) {
    throw Error('uh oh');
  }
  return res.data.games['cs2']['faceit_elo'];
}

async function getLast20GamesCs2Stats(playerId) {
  const res = await axios.get(`https://open.faceit.com/data/v4/players/${playerId}/games/cs2/stats?offset=0&limit=20`, { headers: defaultHeaders });
  const data = {
    kills: 0,
    deaths: 0,
    assists: 0,
    mvps: 0,
    headshotPerc: 0,
    kdR: 0,
    krR: 0
  };
  res.data.items.forEach(item => {
    data.kills += parseInt(item.stats['Kills']);
    data.deaths += parseInt(item.stats['Deaths']);
    data.assists += parseInt(item.stats['Assists']);
    data.mvps += parseInt(item.stats['MVPs']);
    data.headshotPerc += (parseInt(item.stats['Headshots']) / parseInt(item.stats['Kills']));
    data.kdR += parseFloat(item.stats['K/D Ratio']);
    data.krR += parseFloat(item.stats['K/R Ratio']);
  });

  data.kills = Math.round(data.kills / 20);
  data.deaths = Math.round(data.deaths / 20);
  data.assists = Math.round(data.assists / 20);
  data.mvps = Math.round(data.mvps / 20);
  data.headshotPerc = Math.round(data.headshotPerc / 20 * 10000) / 100;
  data.kdR = Math.round(data.kdR / 20 * 100) / 100;
  data.krR = Math.round(data.krR / 20 * 100) / 100;

  return data;
}

async function getPlayerId(username) {
  const res = await axios.get('https://open.faceit.com/data/v4/players', {
    params: { nickname: username },
    headers: defaultHeaders
  });
  if (res.status >= 300 && res.status < 200) {
    throw Error('uh oh');
  }
  return res.data['player_id'];
}

async function getCs2Elo(playerId) {
  let res = await axios.get(`https://open.faceit.com/data/v4/players/${playerId}/games/cs2/stats`);
  if (res.status >= 300 && res.status < 200) {
    throw Error('uh oh');
  }

  res = res.data.items[0].stats;
}
