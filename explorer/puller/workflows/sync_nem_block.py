import argparse
from asyncio import run
from facade.NemPullerFacade import NemPullerFacade

def parse_args():
	parser = argparse.ArgumentParser(description='sync blocks from network')
	parser.add_argument('--nem-node', help='NEM node(local) url', default='http://localhost:7890')
	parser.add_argument('--db-config', help='database config file *.ini', default='config.ini')
	return parser.parse_args()

async def main():
    args = parse_args()

    facade = NemPullerFacade(args.nem_node, args.db_config)

    nem_client = facade.client()
    nem_databases = facade.db

    with nem_databases() as databases:
        databases.create_tables()

        dbHeight = databases.get_current_height()
        print(f"current database height: {nem_client}")
        chainHeight = await nem_client.height()

        # save Nemenesis Block
        if dbHeight == 0:
            block = await nem_client.get_block(1)
            databases.add_block(block['height'], block['timeStamp'])
            dbHeight = block['height']

        # sync network blocks in database
        while chainHeight > dbHeight:

            blocks = await nem_client.get_blocks_after(dbHeight)

            for block in blocks['data']:
                databases.add_block(block['block']['height'], block['block']['timeStamp'])

            dbHeight = blocks['data'][-1]['block']['height']

            print(f"added block height from {blocks['data'][0]['block']['height']} - {blocks['data'][-1]['block']['height']}")

        if (chainHeight == dbHeight):
            print("Database is up to date")

if __name__ == "__main__":
    run(main())
