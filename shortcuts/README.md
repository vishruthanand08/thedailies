# "Save to The Dailies" Shortcut

An iOS Shortcut that saves a score straight from any game's Share button: the NYT Games app,
the LinkedIn app, Safari, anywhere. It needs no app install and costs nothing. Friends get it
from an iCloud link and paste in their own device token once.

Shortcuts can't be generated as files from code, so build it once by hand in the Shortcuts
app, then share it with **Share > Copy iCloud Link** and paste that link into the Devices
card in the web app (`web/src/Friends.jsx`, `SHORTCUT_URL`).

## 1. Get a device token

On thedailies.lol open **Friends > Devices**, tap **New device token**, name it (e.g.
"Shortcut on my iPhone") and copy the token. It starts with `dly_` and is only shown once.
Remove it from the same card to revoke it.

## 2. Build the Shortcut

In the Shortcuts app, tap **+** and name it **Save to The Dailies**.

1. **Details (ⓘ)**: turn on **Show in Share Sheet**. Under "Receive", allow only **Text**
   and **URLs**. Set "If there's no input" to **Get Clipboard**, so running it from the
   home screen saves whatever you just copied.
2. **Text** action: paste your `dly_...` token. Rename the variable to `Token`
   (tap the action's output > Rename).
3. **Get Text from Input** (input: Shortcut Input). Rename the output to `Share Text`.
4. **Get Contents of URL**:
   - URL: `https://www.thedailies.lol/api/submissions`
   - Method: **POST**
   - Headers:
     - `Authorization`: `Bearer ` followed by the `Token` variable (one space after Bearer)
     - `Content-Type`: `application/json`
   - Request Body: **JSON**, one field: key `text`, type Text, value the `Share Text` variable
5. **Get Dictionary Value**: key `error` from Contents of URL.
6. **If** Dictionary Value **has any value**:
   - **Show Notification**: the Dictionary Value (the server's message, e.g. the
     "already have a score today" or stale-puzzle message).
7. **Otherwise**:
   - **Get Dictionary Value**: key `submission.emoji`, then `submission.gameName`, then
     `submission.display` (three actions, all from Contents of URL; Shortcuts accepts
     dotted key paths).
   - **Show Notification**: `<emoji> <gameName> <display> saved`.
8. **End If**.

## The request it sends

```http
POST /api/submissions HTTP/1.1
Host: www.thedailies.lol
Authorization: Bearer dly_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{ "text": "Wordle 1,590 3/6\n\n⬛🟨⬛⬛⬛\n🟩🟩🟩🟩🟩" }
```

Responses:

| Status | Body | Shown as |
| --- | --- | --- |
| 200 | `{ "ok": true, "submission": { "gameId", "gameName", "emoji", "display", "puzzleDate", "verified" } }` | "🟩 Wordle 3/6 saved" |
| 400 | `{ "error": "..." }` (unrecognized or stale share) | the error text |
| 401 | `{ "error": "That device token is no longer valid. ..." }` | the error text; make a new token |
| 409 | `{ "error": "You already have a Wordle score today. ..." }` | the error text |

## Testing it

1. Finish Wordle in the NYT Games app, tap Share, pick **Save to The Dailies**. You should see
   "🟩 Wordle N/6 saved" and the score on the board.
2. Share the same result again: the notification shows the "already have a score" message.
3. Repeat from the LinkedIn app (Queens, Tango, Zip, Pinpoint, Crossclimb, Mini Sudoku, Wend,
   Patches) and from Safari (Worldle, Globle, Travle, Minute Cryptic, Costcodle, Fermi,
   MapTap, Krillion, EthnoGuessr).

If a game's share text comes through differently from the app than from the web (for example
only a link, no text), note it in `apple/capture/fixtures/` so its parser can be checked.
