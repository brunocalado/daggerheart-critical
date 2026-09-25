# 0.2.2

- Fixed for Daggerheart system 2.10: the trigger type (action/reaction) is read from the roll's new action type field again, so "Only Action" and "Only Reaction" configurations work.
- Fixed for Daggerheart system 2.10: Tag Team trigger now listens to the system's Tag Team start hook (tag team data moved to the party actor).
- Removed all AI-generated art from the module (demo critical images, demo art, demo level up images, old preview and thumbnail). They were moved to the ai-assets module.
- Default critical image path is now empty.
- Saved configurations still pointing to the removed demo images fall back to the critical text (image) or to no art (art) instead of showing a broken image.
- New preview image: a real screenshot of the module, no AI art. Also used as the module thumbnail.

# 0.2.1

- fixed extra comma in manifest https://github.com/brunocalado/daggerheart-critical/issues/3
- https://github.com/brunocalado/daggerheart-critical/issues/2

# 0.1.8

- v14

# 0.1.7

- Last release for v13

# 0.1.6
- Quick Actions Request Roll can trigger Critical

# 0.1.4
- Possible tag team fix

# 0.1.3
- Tag Team will send a chat message to the players warning them.

# 0.1.2
- Decoupled Art Size from Text Size configuration to prevent art scaling dependency on font size.
- More font sizes
- More image sizes
- Art supports Video
- Text template css improv
- Fill mode Box fixed
- Fill mode Full Screen fixed
- Delete confirmation dialog
- New Feature: Tag Team Trigger

# 0.1.1
- Bug fix: Preview text was triggering a disabled sound
- Preview sound will now trigger (text, FX, and art)
- New Feature: Level Up Trigger
- Bug fix: Preview sound was triggering for other users
- Bug fix: Preview Art and Sound will now follow the text configuration settings
- Warning removed

# 0.1.0
First release