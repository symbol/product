# Localization

All UI text lives in `src/localization/locales/en.json` — the source locale, other languages are translated from it.
Keys are flat: segments joined with `_`, camelCase inside a segment.

```
screen_<folder>[_<section>]_<element>_<name>[_<element>[_<name>]]

screen_bridge_swap_dialog_confirm_button_cancel
```

## Scopes

Pick the widest scope that fits. Never duplicate a text under a narrower key when a wider one exists.

| Scope | Pattern | Use for |
|---|---|---|
| Global | `<element>_<name>…` | Texts reusable on any screen: common buttons (`button_ok`), input labels (`inputLabel_address`), dialogs, error and validation messages, data families (`transactionType_*`, `month_*`). |
| Screen | `screen_<folder>[_<section>]_<element>_<name>…` | Texts owned by one screen. Components inside a screen folder also use this scope. |
| Component | `component_<componentName>[_<section>]_<element>_<name>…` | Reusable components under `src/components/` that carry their own text (`component_navigationMenu_tab_home`). Rare — most of reusable components receive text via props. |

Global keys may be used anywhere. Screen and component keys only inside their owner.

## Folder and section

- `folder` — the screen's directory name under `src/screens/`, written in camelCase: `address-book` → `screen_addressBook_…`.
- `section` — optional free word after the folder or component name. It groups the keys of one screen or one logical block: a short screen name (`swap` in `screen_bridge_swap_…`) or a logical group (`mnemonic` in `screen_onboarding_mnemonic_description_safety`). At most one, and never an element word.

## Elements

Element words are a fixed vocabulary, in three groups.

Containers — UI blocks that carry one or more texts:

`dialog` `alert` `status` `item` `tab` `step` `button` `link` `checkbox` `toggle` `chip` `widget`

Text kinds — what kind of text it is; ends a key after a container, or stands alone with a name:

`title` `subtitle` `description` `label` `placeholder` `hint` `tooltip` `message`

Combined words — a block and its text kind in one word, always as a `<word>_<name>` pair:

`inputLabel` `fieldTitle` `fieldValue` `screenTitle` `errorMessage` `validationError` `transactionType` `transactionDescriptionShort` `transactionGroup` `transactionStatus` `receiptType` `month` `feeSpeed`

This list is closed. Any other text is named with a container plus a text kind (`dialog_removeAccount_title`).

## Names

A name says which instance of the element the text belongs to.

- A free camelCase word chosen by meaning: `dialog_confirmSwap_title`, `description_neverDisclose`.
- A container is always followed by a name; a combined word takes exactly one name.
- Because names are free, a name may be the same word as an element where that reads naturally (`fieldTitle_message`, `screen_send_title_message`).

## Casing and short forms

- Hand-written segments: camelCase.
- Names copied from code keep the code casing: `screenTitle_CreateWallet`, `fieldValue_AllowMosaics`, `fieldValue_true`.
- Allowed short forms: `qr` `id` `url` `pin` `sdk` `vrf` `nis1` `info` `min` `max`. Everything else is spelled out (`termsAndConditions`).

## Chaining

After the prefix (scope, and for screens the folder and optional section — see "Folder and section"), a key is a chain of element–name pairs:

```
<element>_<name>[_<element>[_<name>]]
```

- One pair is enough when the element holds a single text: `checkbox_acceptRisk`, `title_intro`, `button_ok`.
- A container chains a text kind for its text: `dialog_termsAndPrivacy_title`.
- The chain ends with one more name only when several texts of that kind exist under the same parent: `dialog_termsAndPrivacy_button_accept`.
- Maximum 7 segments in total: `screen_<folder>_<section>_<element>_<name>_<element>_<name>`.

| Case | Example |
|---|---|
| Element + name | `screen_onboarding_title_intro` |
| Container + container name + element | `screen_onboarding_dialog_termsAndPrivacy_title` |
| Container + container name + element + name  | `screen_onboarding_dialog_termsAndPrivacy_button_accept` |

## Common cases

| Case | Form |
|---|---|
| Dialog texts | `dialog_<name>_title`, `_description`, `_button_<name>` |
| Alert, status card, list item | `alert_<name>_title`, `status_<name>_description`, `item_<name>_title` |
| Input label, placeholder, hint | `inputLabel_<name>`, `placeholder_<name>`, `hint_<name>` |
| Step | `<section>_step_<name>` |
| Field title / value (TableView) | `fieldTitle_<fieldName>`, `fieldValue_<Value>` |
| Screen title (route header) | `screenTitle_<RouteName>` |
| Error flash, validation error | `errorMessage_<name>`, `validationError_<name>` |
| Warning | part of the name: `alert_multisigWarning_title` |
| Paragraphs | `<section>_description_<partName>` |
| Screen intro heading and paragraph | `screen_<folder>_title_intro`, `_description_intro` |

## Words that are not elements

| Word | Use instead |
|---|---|
| `warning` | in the name: `nodeDownWarning` |
| `text`, `body` | `description` |
| `name` | `title` |
| `input` | `inputLabel` |
| `p1`, `step1` | a real name: `description_neverDisclose`, `step_saveMnemonic` |

## Dynamic keys

Keys are literal strings. The only exceptions are the registered runtime builders (`screenTitle_${route}`, `fieldTitle_${field}`, `fieldValue_${value}`, `month_${month}`, `feeSpeed_${level}`) and the mapper tables that turn error codes, transaction types and receipt types into literal keys. Do not build keys from variables anywhere else.

## Placeholders

Use `%{name}` in text values: `"Expire %{inTime}"`.
