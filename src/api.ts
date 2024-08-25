import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import User, { type IUser } from './model/user';
import type { Document } from 'mongoose';

dotenv.config();

const users: Array<IUser & Document> = [];

const defaultHeaders = {
  'Authorization': `Bearer ${process.env.FACEIT_API_KEY}`
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
  console.log(req.rawHeaders);
  const username = req.params.username;
  const elo = await getCs2PlayerElo(username);
  res.status(200).send({ elo: elo });

});

api.get('/last20/:username', async (req, res) => {
  console.log(req.rawHeaders);
  const username = req.params.username;
  const playerId = await getPlayerId(username);
  console.log(playerId);
  const stats = await getLast20GamesCs2Stats(playerId, 20);
  res.status(200).send(stats);
});

api.get('/lastGame/:username', async (req, res) => {
  console.log(req.rawHeaders);
  const username = req.params.username;
  const playerId = await getPlayerId(username);
  console.log(playerId);
  const stats = await getLastGameCs2Stats(playerId);
  res.status(200).send(stats);
});

api.get("/winsAgostoRui", async (req, res) => {
  const result = await getGamesHdstr();
  res.status(200).send(result);
})

api.get('/temperatura', async (req, res) => {

});

api.get("/temperatura/:local", async (req, res) => {

  const {localName, localId} = await getLocalIdFromIPMA(req.params.local);
  console.log(localId)
  res.status(200).send(await getTemperaturaLocal(localName, localId))
});

api.get("/desafio/votos/:user/:acredita", async (req, res) => {
  try {
    await saveUserBelief(req.params.user, req.params.acredita);
    res.status(200).send(`Resposta guardada ${req.params.user}`)
  } catch (e) {
    console.log(e)
    if (e instanceof Error) {
      res.status(200).send(e.message);
    }
  }
})

api.get("/desafio/votos", async (req, res) => {
  const votos = await getAllBeliefs();
  const result = votos.reduce((acc, elem) => {
    acc[elem.acredita]++;
    return acc
  }, {sim: 0, nao: 0})
  res.status(200).send(`Resultados atuais: ${result.sim} pessoas acreditam! ${result.nao} pessoas não acreditam :(`);
});

api.get("/media", async (req, res) => {
  const {wins, losses, winRate} = await getGamesHdstr();
  const winsPerDay = get_average(wins);
  res.status(200).send(`O Rui tem de ganhar ${winsPerDay} jogos por dia para atingir o objetivo de 263 vitórias em Agosto.`);
})

api.get("/rui/ladder", async (req, res) => {
  const resAxios = await axios.get("https://open.faceit.com/data/v4/leaderboards/66aad000a91b46496dcd8807/players/114af90a-4d19-4a62-85a0-75ba640c021c", { headers: defaultHeaders });
  const data = resAxios.data;
  res.status(200).send(String(data.position));
})

// Version the api
app.use('/api/v1', api);

async function saveUserBelief(username: string, believes: string) {
  if (users.length === 0) {
    console.log("nunca");
    users.push(...(await User.find({})));
  }
  const foundUser = users.find(user => user.name === username);
  if (foundUser !== undefined) {
    throw new Error("Resposta previamente registada.")
  }
  const user = new User({ name: username, acredita: believes });
  const savedUser = await user.save();
  users.push(savedUser);
}

async function getAllBeliefs() {
  if (users.length === 0) {
    console.log("nunca");
    users.push(...(await User.find({})));
  }
  return users;
}

function get_average(wins){
  var today = new Date();
  today.setHours(today.getHours() + 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysLeft = lastDay.getDate() - today.getDate() + 1;
  const winsLeft = 263 - wins;
  let winsPerDay = winsLeft / daysLeft;
  winsPerDay = Math.round(winsPerDay * 100) / 100;

  return winsPerDay;
}

async function getLocalIdFromIPMA(localName = "Braga") {
  const res = await axios.get("https://api.ipma.pt/public-data/forecast/locations.json");
  const filtered = res.data.filter(obj => obj.local.toLowerCase() === localName.toLowerCase())
  if (filtered.length === 0) { return {localId: null, localName: localName}; }
  return {localName: filtered[0].local, localId: filtered[0].globalIdLocal};
}


async function getTemperaturaLocal(localName = "Braga", localId = "1030300") {
  const dia = new Date();
  dia.setHours(dia.getHours() + 1);
  dia.setMinutes(0);
  dia.setSeconds(0);
  dia.setMilliseconds(0);

  try {
    const res = await axios.get(`https://api.ipma.pt/public-data/forecast/aggregate/${localId}.json`)
    const jsonData = res.data;

    const diaria = jsonData[0];
    let atual: any | undefined;
    for (const hora of jsonData) {
      const dataPrev = new Date(hora.dataPrev);
      if (dataPrev.toISOString() === dia.toISOString()) {
        atual = hora;
        break;
      }
    }

    if (atual) {
      console.log(atual)
      return `Temperatura atual em ${localName}: ${atual.tMed}ºC. Previsão máxima para hoje: ${diaria.tMax}ºC. Previsão mínima para hoje: ${diaria.tMin}ºC.`;
    }
    return 'Dados de temperatura não disponíveis para o horário atual.';
  } catch (err) {
    console.log(err)
    return 'Erro ao processar dados.';
  }

}

async function getCs2PlayerElo(username) {
  const res = await axios.get('https://open.faceit.com/data/v4/players', {
    params: { nickname: username },
    headers: defaultHeaders
  });
  if (res.status >= 300 && res.status < 200) {
    throw Error('uh oh');
  }
  return res.data.games.cs2.faceit_elo;
}

async function getLastGameCs2Stats(playerId) {
  const res = await axios.get(`https://open.faceit.com/data/v4/players/${playerId}/games/cs2/stats?offset=0&limit=1`, { headers: defaultHeaders });
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const data: any = {};

  data.kills = Math.round(res.data.items[0].stats['Kills']);
  data.deaths = Math.round(res.data.items[0].stats['Deaths']);
  data.assists = Math.round(res.data.items[0].stats['Assists']);
  data.mvps = Math.round(res.data.items[0].stats['MVPs']);
  data.hsP = Math.round((parseInt(res.data.items[0].stats['Headshots']) / parseInt(res.data.items[0].stats['Kills'])) * 10000) / 100;
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

async function getGamesHdstr() {
  let wins = 0;
  let losses = 0;
  let games = []
  let c = 0;
  do {
    const res = await axios.get(`https://open.faceit.com/data/v4/players/114af90a-4d19-4a62-85a0-75ba640c021c/history?game=cs2&from=1722466800&limit=100&offset=${100 * c}`, { headers: defaultHeaders })
    games = res.data.items;
    console.log(games)
    for (const game of games) {
      const result = game.results.winner;
      if (game.teams[result].players.find(player => player.player_id === "114af90a-4d19-4a62-85a0-75ba640c021c")) {
        wins++;
      } else {
        losses++;
      }
    }
    c++
  } while (games.length !== 0)

  const winRate = Math.round(wins / (wins + losses) * 100)

  return { wins, losses, winRate };

}
