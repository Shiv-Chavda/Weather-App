const express = require('express');
const promBundle = require('express-prom-bundle');
const promClient = require('prom-client');
const path = require('path');

// Create a Registry which registers the metrics
const register = new promClient.Registry();

// Add default metrics to the registry
promClient.collectDefaultMetrics({ register });

// Initialize Express
const app = express();
const port = 3000;

// Create custom metrics
const weatherQueries = new promClient.Counter({
  name: 'weather_app_queries_total',
  help: 'Total number of weather queries',
  labelNames: ['city', 'status'],
  registers: [register] // Explicitly add to registry
});

const weatherQueryDuration = new promClient.Histogram({
  name: 'weather_app_query_duration_seconds',
  help: 'Duration of weather API queries in seconds',
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const citiesQueried = new promClient.Gauge({
  name: 'weather_app_cities_queried',
  help: 'Number of unique cities queried',
  registers: [register]
});

// Express-prom-bundle middleware
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { project_name: 'weather_app', project_type: 'web_application' },
  promClient: {
    collectDefaultMetrics: {
      register: register // Use the same registry
    }
  }
});

app.use(metricsMiddleware);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Add metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

// Weather API endpoint
const citiesSet = new Set();
app.get('/api/weather', async (req, res) => {
  const start = Date.now();
  const city = req.query.city || 'unknown';
  let status = 'success';

  try {
    // Track the city
    citiesSet.add(city);
    citiesQueried.set(citiesSet.size);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    
    const duration = (Date.now() - start) / 1000;
    weatherQueryDuration.observe(duration);
    
    res.json({ success: true, city });
  } catch (error) {
    status = 'error';
    res.status(500).json({ success: false, error: error.message });
  } finally {
    weatherQueries.inc({ city, status });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Weather app listening at http://localhost:${port}`);
});