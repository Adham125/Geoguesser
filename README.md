# Intro

[http://adhamgames.co.uk](http://adhamgames.co.uk/)

Hello!
This is a free online game site with two games to pick from:

- **GeoGuesser** — singleplayer and multiplayer. You get dropped in a random location and have to guess where on the world map you are.
- **Catan** — multiplayer (2–4 players). Settle the island: gather resources, build roads, settlements and cities, and race to 10 victory points.

After logging in (or playing as a guest) you choose your game from the hub screen.

Made by: [Adham125](https://github.com/Adham125)

If you enjoy it, you can [tip me on Ko-fi](https://ko-fi.com/adham125) to help cover the server bills.

# Controls

- "Confirm" button locks in your guess.

- "Next" button generates next round.

- "Start Location" button teleports you back to where you started the round.
  
# How To Play (Singleplayer)

1- Select a gamemode to play, number of rounds, and gameplay options then press "Start Game".

2- Click a location on the map and confirm (by pressing the "Confirm" button) to lock in your guess.

3- Your score and distance to the actual location will be presented to you.

4- After closing the results popup the actual location will be identified on the map with another marker.

5- Press the "Next" button to start a new round.

# How To Play (Multiplayer)

1- Select the Create Lobby button.

2- Enter your username and the colour you'd like your guesses to show up as.

3- Share the Room Code with the people you want to play with.

4- Adjust the settings as you wish and then start the game

  (Only the room creator can start the game and every next round)

To Join a Room:

1- Enter the Room Code in the text field next to the "Join Room" button.

2- Select "Join Room" button.

3- Enter your username and the colour you'd like your guesses to show up as.

4- Select the "Enter Room" button.


## Country Select Mode
1- Choose a country for the random location to be picked from.

2- Play as usual.

3- Score will be calculated based on the area of the country you selected (will need to be much closer to the location to achieve a high score).

## Hide And Seek Mode (Multiplayer)

1- One player is the Hider and picks a Street View spot on the map during the HIDE phase.

2- Once everyone is locked in, the SEEK phase starts — the other players hunt for the Hider's location in Street View before the timer runs out.

3- The Hider watches the seekers' live views from tabs at the top of the screen.

# How To Play (Catan)

1- Pick **Catan** on the hub screen, then **Create Game** (or enter a friend's room code and **Join**).

2- Share the room code. Everyone picks a name and colour and clicks **Ready ✓** — the lobby shows who's ready with a tick or a cross. The host can start once 2–4 players are all ready.

3- Place your two starting settlements and roads (the board highlights your legal spots), then take turns: roll the dice, collect resources, build, and trade with the bank (4:1).

4- Rolling a 7 moves the robber: players holding more than 7 cards discard half, then the roller blocks a hex and steals a card.

5- First player to **10 victory points** (settlements = 1, cities = 2) wins.

You can refresh or briefly disconnect mid-game — your seat is saved and the game picks up where you left off.

*Current version is the base game: development cards, player-to-player trading, ports, and longest road / largest army are planned.*

# Local Setup

To download and run the code locally you will need to have Jekyll, Ruby, RubyGems, and GCC/Make on your machine.

```sh
gem install bundler jekyll
bundle install
bundle exec jekyll serve
```

This runs the frontend only — singleplayer GeoGuesser modes (Classic and Country Select) work standalone. The multiplayer server is hosted privately, so multiplayer GeoGuesser, Catan, and login require the production site at [adhamgames.co.uk](http://adhamgames.co.uk/).
