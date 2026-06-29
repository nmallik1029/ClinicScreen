/**
 * Guided-walkthrough definitions. Each tour is an ordered list of coachmarks.
 * `target` is the value of a `data-tour="..."` attribute somewhere on the page
 * the tour runs on; the Walkthrough overlay finds it, spotlights it, and shows
 * the title/body. Tours are launched via a `?tour=<id>` query param (set by the
 * overview setup checklist).
 */
export type TourStep = { target: string; title: string; body: string };

export const TOURS: Record<string, TourStep[]> = {
  // Screens page — pairing a new TV.
  pair: [
    {
      target: "screens-pair-card",
      title: "Pair a screen",
      body: "This panel connects a TV to ClinicScreen. On the TV, open the ClinicScreen Player app — it shows a short pairing code.",
    },
    {
      target: "pair-code",
      title: "Enter the pairing code",
      body: "Type the code shown on the TV into this box.",
    },
    {
      target: "pair-name",
      title: "Name the screen",
      body: "Give it a name you'll recognize, like Waiting Room.",
    },
    {
      target: "pair-submit",
      title: "Connect it",
      body: "Click here. The screen joins your list — next you'll give it a playlist.",
    },
  ],

  // Locations page — creating the first location.
  addLocation: [
    {
      target: "locations-form",
      title: "Add a location",
      body: "A location is an office or building, like Main Office. Your screens get grouped under it.",
    },
    { target: "location-name", title: "Name it", body: "Enter the location name here." },
    {
      target: "location-submit",
      title: "Save it",
      body: "Click Add location, then go back to Screens to place each screen in its room.",
    },
  ],

  // Screens page — placing a paired screen in a room/location.
  place: [
    {
      target: "screen-row",
      title: "Place your screens",
      body: "Each paired screen is listed here. Set where each one is so staff know which is which.",
    },
    {
      target: "screen-location",
      title: "Pick its location",
      body: "Choose which location this screen is in.",
    },
    { target: "screen-save", title: "Save", body: "Click Save changes to store it." },
  ],

  // Media page — uploading content.
  upload: [
    {
      target: "media-form",
      title: "Upload media",
      body: "Add a video or image that patients should see on the screens.",
    },
    {
      target: "media-title",
      title: "Give it a title",
      body: "Name it so you can find it later, like Blood Pressure Basics.",
    },
    {
      target: "media-file",
      title: "Choose the file",
      body: "Pick the image or video from this computer.",
    },
    { target: "media-submit", title: "Upload", body: "Click Upload media. It's added to your library." },
  ],

  // Playlists page — building a loop.
  build: [
    {
      target: "playlists-form",
      title: "Build a playlist",
      body: "A playlist is the loop a screen plays on repeat. Start by naming it.",
    },
    { target: "playlist-name", title: "Name the playlist", body: "Something like Waiting Room Loop." },
    {
      target: "playlist-submit",
      title: "Create it",
      body: "Click Create playlist, then open it to add your uploaded media.",
    },
  ],

  // Screens page — assigning a playlist to a screen.
  assign: [
    {
      target: "screen-playlist",
      title: "Send a playlist to the screen",
      body: "Choose the playlist this screen should play.",
    },
    {
      target: "screen-save",
      title: "Save",
      body: "Click Save changes — the screen starts playing right away.",
    },
  ],
};
