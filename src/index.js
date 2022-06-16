import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

const EXPERIMENT_DATABASE_ID = '332afb66ee894ef583189edd20661331';
// const WORKITEM_DATABASE_ID = 'b06a7e1149b94480ba0eb97afc9e780c';
const TASK_DATABASE_ID = 'e3d55c12d06042f3bec5b9138a57c8a3';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_KEY })

async function getExperiments() {
    const pages = []
    let cursor = undefined
    while (true) {
      const { results, next_cursor } = await notion.databases.query({
        database_id: EXPERIMENT_DATABASE_ID,
        start_cursor: cursor,
      })
      pages.push(...results)
      if (!next_cursor) {
        break
      }
      cursor = next_cursor
    }
    console.log(`${pages.length} issues successfully fetched.`)
    return pages.map(page => {
      return {
        pageId: page.id,
        workItems: page.properties["Work Items"].relation,
        name: page.properties["Name"].title[0].plain_text,
      }
    })
}

async function getWorkItemDetails(id) {
    const page = await notion.pages.retrieve({
        page_id: id
    });

    return {
        pageId: page.id,
        name: page.properties["Name"].title[0].plain_text,
        type: page.properties["Type"].select.name,
        tasks: page.properties["Tasks"].relation,
        stories: page.properties["Epic - Work Items (New Epic)"].relation,
    };
}

async function getTasksForWorkItem(worktItemId) {
    const pages = [];
    let cursor = undefined;
    while (true) {
      const { results, next_cursor } = await notion.databases.query({
        database_id: TASK_DATABASE_ID,
        start_cursor: cursor,
        filter: {
            property: 'Related Work Item',
            relation: {
                contains: worktItemId,
            }
        }
      });
      pages.push(...results);
      if (!next_cursor) {
        break;
      }
      cursor = next_cursor;
    }
    console.log(`${pages.length} issues successfully fetched.`);
    return pages.map(page => {
      return {
        pageId: page.id,
        person: page.properties["Person"].people.map(p => p.name),
        name: page.properties["Name"].title[0].plain_text,
        timeSpent: page.properties["Time Spent"].number,
      }
    });
}

async function execute() {
    const experiments = await getExperiments();

    const topLevelPromises = experiments.map(async exp => {
        const epicTotalPromises = exp.workItems.map(async workItem => {
            const workItemDetail = await getWorkItemDetails(workItem.id);

            // console.log('>>>> Work item detail', workItemDetail);

            // combine the current work item id with the story ids and for each one
            // query the tasks database for all tasks that relate to each one.
            const workItemsIds = [
                ...workItemDetail.stories.map(story => story.id),
                workItemDetail.pageId,
            ];

            // console.log('>>>>>>>>>>> we will query for work items', workItemsIds);

            const workItemTotalsPromises = workItemsIds.map(async id => {
                const tasks = await getTasksForWorkItem(id);

                // console.log('>>>>>> some tasks', tasks);

                // for each task calculate the total for each unique person.
                const totals = {};
                tasks.forEach(task => {
                    task.person.forEach(p => {
                        totals[p] = (totals[p] || 0) + (task.timeSpent / task.person.length);
                    });
                });

                return totals;
            });

            const workItemTotals = await Promise.all(workItemTotalsPromises);

            // console.log('>>>> work item totals', workItemTotals);

            // reduce down to a single object
            const epicTotal = workItemTotals.reduce((previousValue, currentValue) => {
                const newValue = {
                    ...previousValue
                };
                Object.keys(currentValue).forEach(key => newValue[key] = (newValue[key] || 0) + currentValue[key]);

                return newValue;
            }, {});

            // console.log('>>>>>> epic totals', epicTotal);

            return epicTotal;
        });

        const epicTotals = await Promise.all(epicTotalPromises);

        // reduce to a single object.
        const experimentTotals = epicTotals.reduce((previousValue, currentValue) => {
            const newValue = {
                ...previousValue
            };
            Object.keys(currentValue).forEach(key => newValue[key] = (newValue[key] || 0) + currentValue[key]);

            return newValue;
        }, {});

        console.log('>>>>>> experiment totals', experimentTotals);

        return {
            experimentId: exp.pageId,
            name: exp.name,
            totals: experimentTotals,
        };
    });

    const finalTotals = await Promise.all(topLevelPromises);

    console.log('Final totals', finalTotals);
}

await execute();
