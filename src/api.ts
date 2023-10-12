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
  const stats = await getLast20GamesCs2Stats(playerId, 20);
  res.status(200).send(stats);
});

api.get('/lastGame/:username', async (req, res) => {
  const username = req.params['username'];
  const playerId = await getPlayerId(username);
  console.log(playerId);
  const stats = await getLastGameCs2Stats(playerId);
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

async function getLastGameCs2Stats(playerId) {
  const res = await axios.get(`https://open.faceit.com/data/v4/players/${playerId}/games/cs2/stats?offset=0&limit=1`, { headers: defaultHeaders });
  const data: any = {};

  data.kills = Math.round(res.data.items[0].stats['Kills']);
  data.deaths = Math.round(res.data.items[0].stats['Deaths']);
  data.assists = Math.round(res.data.items[0].stats['Assists']);
  data.mvps = Math.round(res.data.items[0].stats['MVPs']);
  data.headshotPerc = Math.round((parseInt(res.data.items[0].stats['Headshots']) / parseInt(res.data.items[0].stats['Kills'])) * 10000) / 100;
  data.kdR = Math.round(res.data.items[0].stats['K/D Ratio'] * 100) / 100;
  data.krR = Math.round(res.data.items[0].stats['K/R Ratio'] * 100) / 100;
  data.result = res.data.items[0].stats["Result"] == 0 ? "L" : "W";
  data.matchId = res.data.items[0].stats["Match Id"];

  return data;
}

async function getLast20GamesCs2Stats(playerId, numberOfGames) {
  const res = await axios.get(`https://open.faceit.com/data/v4/players/${playerId}/games/cs2/stats?offset=0&limit=${numberOfGames}`, { headers: defaultHeaders });
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

  data.kills = Math.round(data.kills / numberOfGames);
  data.deaths = Math.round(data.deaths / numberOfGames);
  data.assists = Math.round(data.assists / numberOfGames);
  data.mvps = Math.round(data.mvps / numberOfGames);
  data.headshotPerc = Math.round(data.headshotPerc / numberOfGames * 10000) / 100;
  data.kdR = Math.round(data.kdR / numberOfGames * 100) / 100;
  data.krR = Math.round(data.krR / numberOfGames * 100) / 100;

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
