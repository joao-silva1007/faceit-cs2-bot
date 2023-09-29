import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const defaultHeaders = {
  'Authorization': `Bearer ${process.env["FACEIT_API_KEY"]}`
}

export const app = express();

app.use(cors({origin: true}));

app.use(express.json());
app.use(express.raw({type: 'application/vnd.custom-type'}));
app.use(express.text({type: 'text/html'}));

// Healthcheck endpoint
app.get('/', (req, res) => {
  res.status(200).send({status: 'ok'});
});

const api = express.Router();

api.get('/hello', (req, res) => {
  res.status(200).send({message: 'hello world'});
});

api.get("/elo/:username", async (req, res) => {
  const username = req.params["username"];
  const elo = await getCs2PlayerElo(username);
  res.status(200).send({elo: elo});

});

// Version the api
app.use('/api/v1', api);

async function getCs2PlayerElo(username) {
  const res = await axios.get("https://open.faceit.com/data/v4/players", {params: {nickname: username}, headers: defaultHeaders});
  console.log(res.status);
  console.log(res.data);
  if (res.status >= 300 && res.status < 200) {
    throw Error("uh oh");
  }
  return res.data.games["cs2"]["faceit_elo"];
}

async function getPlayerId(username) {
  const res = await axios.get("https://open.faceit.com/data/v4/players", {params: {nickname: username}, headers: defaultHeaders});
  if (res.status >= 300 && res.status < 200) {
    throw Error("uh oh");
  }
  return res.data["player_id"];
}

async function getCs2Elo(playerId) {
  let res = await axios.get(`https://open.faceit.com/data/v4/players/${playerId}/games/cs2/stats`);
  if (res.status >= 300 && res.status < 200) {
    throw Error("uh oh");
  }

  res = res.data.items[0].stats;
}
