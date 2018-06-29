require('dotenv').config();

const Koa = require('koa');
const cors = require('kcors');
const retry = require('async-retry')
const fetch = require('node-fetch');
const cache = require('lru-cache')({
  maxAge: 1000 * 15 // 15 seconds
});
setInterval(() => cache.prune(), 1000 * 60); // Prune every minute

const app = new Koa();
app.use(cors());

app.use(async (ctx) => {
  const { id } = ctx.request.query;

  if (!id){
    ctx.body = {
      name: 'arrivelah',
      project_url: 'https://github.com/cheeaun/arrivelah',
      instruction: 'Bus stop code (`id` URL parameter) is required. E.g.: `/?id=83139`. List of the codes here: https://github.com/cheeaun/busrouter-sg/blob/master/data/2/bus-stops.geojson',
      current_bus_arrival_queries: cache.keys(),
    };
    return;
  }

  let services = cache.get(id);
  console.log('🚌  ' + id);

  if (!services){
    const url = 'http://datamall2.mytransport.sg/ltaodataservice/BusArrivalv2?BusStopCode=' + id;
    console.log('Fetch ' + url);
    await retry(async (bail) => {
      const res = await fetch(url, {
        timeout: 1000 * 10, // 10 seconds
        headers: {
          AccountKey: process.env.accountKey,
        },
      });
      const { status } = res;
      const body = await res.json();

      if (status !== 200 || !body){
        bail();
        ctx.body = {
          error: 'Invalid bus stop ID provided.'
        };
        return;
      }

      const now = Date.now();
      const arrivalResponse = (bus) => {
        const arrival = bus.EstimatedArrival;
        return {
          time: arrival,
          duration_ms: arrival ? (new Date(arrival) - now) : null,
          lat: parseFloat(bus.Latitude, 10),
          lng: parseFloat(bus.Longitude, 10),
          load: bus.Load,
          feature: bus.Feature,
          type: bus.Type,
        };
      };

      services = body.Services.map((service) => {
        const { NextBus, NextBus2, NextBus3 } = service;

        return {
          no: service.ServiceNo,
          operator: service.Operator,
          next: arrivalResponse(NextBus),
          subsequent: arrivalResponse(NextBus2), // Legacy pre
          next2: arrivalResponse(NextBus2),
          next3: arrivalResponse(NextBus3),
        }
      });

      cache.set(id, services);
    }, {
      retries: 3,
    });
  }

  ctx.body = {
    services,
  };
});

const port = process.env.PORT || 8081;
app.listen(port);
console.log('Server started at localhost:' + port);
