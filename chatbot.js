const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('🎭 Theater Chatbot Backend is live! Use /message to chat with the movie buff bot. 🍿🎬');
});

// TMDB API integration
const TMDB_API_KEY = 'b3fb7b6233f7417b622edad0718b6812';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

async function fetchTMDBMovies(city, date = null) {
  try {
    const url = `${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-IN&page=1&region=IN`;
    const response = await axios.get(url);
    const movies = response.data.results;

    if (!movies || movies.length === 0) return null;

    const shows = await Promise.all(movies.slice(0, 5).map(async (m) => {
      const detailsUrl = `${TMDB_BASE_URL}/movie/${m.id}?api_key=${TMDB_API_KEY}&language=en-IN&append_to_response=credits`;
      const detailRes = await axios.get(detailsUrl);
      const details = detailRes.data;
      const actors = details.credits.cast.slice(0, 3).map(actor => actor.name).join(', ');

      return `🎬 *${m.title}* (${m.release_date})
🖼️ *Poster:* ${TMDB_IMAGE_BASE}${m.poster_path}
⭐ *Rating:* ${m.vote_average}/10
🧾 *Storyline:* ${m.overview}
🌐 *Language:* ${m.original_language.toUpperCase()}
🎬 *Runtime:* ${details.runtime} mins
🎭 *Top Cast:* ${actors}`;
    }));

    return shows.join('\n\n🎟️ ------------------\n\n');
  } catch (error) {
    console.error('TMDB API error:', error.response?.data || error.message);
    return null;
  }
}

async function fetchUpcomingMovies() {
  try {
    const url = `${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-IN&page=1&region=IN`;
    const response = await axios.get(url);
    const movies = response.data.results.slice(0, 5);

    return movies.map(m => `🎬 *${m.title}* (${m.release_date})\n🖼️ *Poster:* ${TMDB_IMAGE_BASE}${m.poster_path}\n🧾 *Overview:* ${m.overview}\n⭐ *Rating:* ${m.vote_average}/10`).join('\n\n🎟️ ------------------\n\n');
  } catch (error) {
    console.error('TMDB Upcoming error:', error.response?.data || error.message);
    return null;
  }
}

async function fetchMovieDetails(query) {
  try {
    const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-IN`;
    const searchRes = await axios.get(searchUrl);
    const movie = searchRes.data.results[0];
    if (!movie) return null;

    const detailsUrl = `${TMDB_BASE_URL}/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=en-IN&append_to_response=credits`;
    const detailRes = await axios.get(detailsUrl);
    const details = detailRes.data;
    const actors = details.credits.cast.slice(0, 5).map(actor => actor.name).join(', ');

    return {
      title: details.title,
      release: details.release_date,
      rating: details.vote_average,
      overview: details.overview,
      language: details.original_language.toUpperCase(),
      runtime: details.runtime,
      cast: actors,
      poster: `${TMDB_IMAGE_BASE}${details.poster_path}`
    };
  } catch (error) {
    console.error('TMDB Movie Details error:', error.response?.data || error.message);
    return null;
  }
}

app.post('/message', async (req, res) => {
  const userMsg = req.body.message.toLowerCase();
  const dateKeywords = ['today', 'tomorrow'];

  const cityMatch = userMsg.match(/(?:in|at|for)\s+([a-zA-Z\s]+)/i);
  const city = cityMatch ? cityMatch[1].trim() : null;
  const date = dateKeywords.find(d => userMsg.includes(d));

  if (userMsg.includes('upcoming')) {
    const upcoming = await fetchUpcomingMovies();
    if (upcoming) return res.json({ reply: `🎬 *Upcoming Movies in India:*

${upcoming}` });
    else return res.json({ reply: "😕 Couldn't fetch upcoming movies right now." });
  }

  if (userMsg.includes('about') || userMsg.includes('tell me about')) {
    const movieNameMatch = userMsg.match(/about\s+(.*)/);
    if (movieNameMatch) {
      const movie = await fetchMovieDetails(movieNameMatch[1].trim());
      if (movie) {
        return res.json({
          reply: `🎬 *${movie.title}* (${movie.release})\n🖼️ *Poster:* ${movie.poster}\n⭐ *Rating:* ${movie.rating}/10\n🧾 *Overview:* ${movie.overview}\n🌐 *Language:* ${movie.language}\n🎬 *Runtime:* ${movie.runtime} mins\n🎭 *Cast:* ${movie.cast}`
        });
      } else {
        return res.json({ reply: "😕 I couldn't find details for that movie." });
      }
    }
  }

  const detailMatch = userMsg.match(/(?:who acted in|cast of|rating of|runtime of|length of)\s+(.*)/i);
  if (detailMatch) {
    const movie = await fetchMovieDetails(detailMatch[1].trim());
    if (!movie) return res.json({ reply: "😕 I couldn't find that movie." });

    let reply = `🎬 *${movie.title}* (${movie.release})\n`;
    if (userMsg.includes('cast') || userMsg.includes('who acted')) reply += `🎭 *Cast:* ${movie.cast}`;
    else if (userMsg.includes('rating')) reply += `⭐ *Rating:* ${movie.rating}/10`;
    else if (userMsg.includes('runtime') || userMsg.includes('length')) reply += `🎬 *Runtime:* ${movie.runtime} mins`;
    else reply += `🧾 *Overview:* ${movie.overview}`;

    reply += `\n🖼️ *Poster:* ${movie.poster}`;
    return res.json({ reply });
  }

  if (city) {
    const realTimeShows = await fetchTMDBMovies(city, date);
    if (realTimeShows) {
      const datePart = date ? ` for ${date}` : '';
      return res.json({ reply: `🎉 *Now showing in ${city}${datePart}*:\n\n${realTimeShows}` });
    } else {
      const datePart = date ? ` on ${date}` : '';
      return res.json({ reply: `😕 No shows found for ${city}${datePart}. Try another city or day.` });
    }
  }

  return res.json({ reply: "🤖 Please include a city name (like 'in Delhi') or ask about a specific movie." });
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
