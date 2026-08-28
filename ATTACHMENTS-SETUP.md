# Attachments — Google Drive service account setup

HQ stores attachments (quotations, SOAs, BIR forms, receipts, signed DRs,
licenses, item photos) in Google Drive. Supabase keeps only the **file id** and
a little metadata; Drive keeps the bytes. A Netlify function does the upload
using a **service account** — a robot Google identity that belongs to the
company, not to a person, so nothing breaks when someone leaves.

**Do this once.** It takes about 15 minutes. Nothing in this file needs to be
shared with anyone outside Healthspan, and the private key never leaves your
browser and Netlify.

---

## Why a Shared Drive (read this before step 4)

A service account has **no Drive storage of its own**. If you share a folder
from your personal My Drive with it and it uploads there, Google makes the
service account the file owner and the upload fails with
`storageQuotaExceeded`. Files in a **Shared Drive** are owned by the drive, so
uploads work and the files survive any individual leaving.

Shared Drives come with Google Workspace, which Healthspan has.

---

## 1 · Create (or pick) a Google Cloud project

1. Go to <https://console.cloud.google.com> and sign in as **angelo@remedy.ph**
   (or a Healthspan Workspace admin account).
2. Click the project dropdown in the top bar → **New project**.
3. Name it `healthspan-hq`. Leave the organisation as the default.
4. Click **Create**, then make sure `healthspan-hq` is the selected project.

## 2 · Turn on the Drive API

1. Left menu → **APIs & Services → Library**.
2. Search **Google Drive API** → open it → **Enable**.
   (Only the Drive API. Nothing else is needed.)

## 3 · Create the service account and its key

1. Left menu → **APIs & Services → Credentials**.
2. **Create credentials → Service account**.
   - Name: `hq-attachments`
   - Description: `Uploads HQ attachments to the Healthspan Drive`
   - **Create and continue** → skip the optional role step → **Done**.
     (It needs no project roles — its access comes from the Drive share.)
3. Click the new service account in the list → **Keys** tab.
4. **Add key → Create new key → JSON → Create.**
   A `.json` file downloads. **This is a password.** Keep it out of GitHub,
   out of email, out of chat — including out of any message to me. I never
   need to see it.
5. Open the JSON in a text editor. Two values matter:
   - `"client_email"` — looks like
     `hq-attachments@healthspan-hq.iam.gserviceaccount.com`
   - `"private_key"` — a long block starting `-----BEGIN PRIVATE KEY-----`

## 4 · Create the Shared Drive and let the robot in

1. Go to <https://drive.google.com> → left menu → **Shared drives** →
   **+ New** → name it `HQ Attachments` → **Create**.
2. Open it → **Manage members** (or the ⋯ menu → *Manage members*).
3. Paste the service account's `client_email` from step 3.
4. Give it **Content manager** (it must be able to create files; it does not
   need Manager).
5. **Send** / **Done**. Google may warn that this address is outside your
   contacts — that is expected for a service account.
6. Inside the Shared Drive, create a folder called `HQ`.
7. Open that folder and copy its **id** from the address bar — the part after
   `/folders/`:
   `https://drive.google.com/drive/folders/`**`1AbC...XyZ`**

## 5 · Put the three values into Netlify

1. Netlify → your site → **Site configuration → Environment variables**.
2. Add three variables:

| Key | Value |
|---|---|
| `GDRIVE_CLIENT_EMAIL` | the `client_email` from the JSON |
| `GDRIVE_PRIVATE_KEY` | the whole `private_key` value, including the BEGIN/END lines |
| `GDRIVE_FOLDER_ID` | the folder id from step 4.7 |

For `GDRIVE_PRIVATE_KEY`, paste the value exactly as it appears in the JSON —
including the `\n` sequences if your editor shows them that way. The function
converts `\n` back into real newlines, so either form works.

3. **Save**, then **Deploys → Trigger deploy → Deploy site** so the new
   variables are picked up.

## 6 · Tell me it's done

Then I build:

- `netlify/functions/upload.mjs` — verifies the signed-in session, streams the
  file to the Shared Drive folder, returns the file id;
- an `attachments` table in Supabase (record type, record id, file id, name,
  size, mime, uploaded by/at) with RLS matching the record it hangs off;
- an attach/preview control on visits, accounts, orders, pull-outs, complaints
  and the seven finance forms.

## Who can remove a file

Removing an attachment is decided in `upload.mjs`, not in the browser. This
matters more than it sounds: a DELETE that RLS filters down to nothing still
comes back from PostgREST as a success, so the old code reported "removed",
left the row in place, and destroyed the Drive file anyway — for someone who had
no right to remove it. The function now looks the row up with the service key,
allows it only for whoever uploaded it (or an admin, finance, supply-chain or
super-admin account), removes the row, and only then removes the file.

Reading and attaching are deliberately wider: these are company records, and the
pages that show them are already role-gated. What is narrow is destruction.

## Housekeeping

- **Rotate the key** if it is ever exposed: Credentials → the service account →
  Keys → delete the old key, create a new one, update Netlify.
- **The robot can only see what you share with it.** It has access to the
  `HQ Attachments` Shared Drive and nothing else in your Google account.
- **Deleting a Healthspan person's Google account does not affect attachments**,
  because the Shared Drive owns the files — that is the whole point of doing it
  this way rather than under someone's personal Drive.
- Storage counts against the Workspace pool, same as any Shared Drive.

---

## Note on the Drive scope

The function requests the full `https://www.googleapis.com/auth/drive` scope
rather than the narrower `drive.file`. That is deliberate and necessary:
`drive.file` only lets a service account touch files **it created itself**, so
it cannot see the `HQ` folder you made by hand — every upload would fail with
"File not found" on the parent folder.

The robot is still tightly confined, because a service account can only reach
what has been shared with it: the `HQ Attachments` Shared Drive, and nothing
else in Healthspan's Google account. If you would rather use `drive.file`, the
alternative is to let the function create its own folder on first run and store
that id — say the word and I will switch it.

## Testing it

Once the variables are set and the site has redeployed, sign in as the super
admin and open **Admin → Cutover switches → Attachments → Test the connection**.
It reports the folder name, confirms the key works, and warns if the folder is
*not* on a Shared Drive — the one misconfiguration that looks correct but fails
with a quota error on the first upload.
