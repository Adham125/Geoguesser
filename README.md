# Intro

https://adham125.github.io/Geoguesser/

Hello!
This is a free singleplayer GeoGuesser game! You get dropped in a random location and have to guess where on the world map you are.

Made by: [Adham125](https://github.com/Adham125)

# Controls

- "Confirm" button locks in your guess.

- "Next" button generates next round.

<!--- Range slider changes the search radius for google street view locations i.e. Higher number finds locations faster but will be more obscure locations and smaller is the opposite.-->

# How To Play

1- Select a gamemode to play, number of rounds, and gameplay options then press "Start Game".

2- Click a location on the map and confirm (by pressing the "Confirm" button) to lock in your guess.

3- Your score and distance to the actual location will be presented to you.

4- After closing the results popup the actual location will be identified on the map with another marker.

5- Press the "Next" button to start a new round.

## Country Select Mode
1- Choose a country for the random location to be picked from.

2- Play as usual.

3- Score will be calculated based on the area of the country you selected (will need to be much closer to the location to achieve a high score).

# Local Setup

To download and run the code locally you will need to have <!-- [npm](https://nodejs.org/en/download) -->Jekyll, Ruby, RebyGems, and GCC/Make on your machine.

```sh
gem install bundler jekyll
bundle install
bundle exec jekyll serve 
```
