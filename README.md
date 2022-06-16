# Extract hours by person and experiment from Notion

This is a rather quickly hacked together script to enable aggregating hours by person for each experiment in Notion.

This script requires NodeJs v16

To run this script:

1. Create a `.env` file with a single value for `NOTION_KEY` - this is the key created when setting up a Notion integration.
2. Run `npm run start` - results will be printed to the console.

## Things to improve

* Ensure we only report on tasks that were performed in the current financial year
* Specify the date range to report on
* Support formatting to CSV
