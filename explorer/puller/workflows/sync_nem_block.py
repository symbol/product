import argparse
from client.NemClient import NemClient
from asyncio import run
from db.Databases import Databases

def parse_args():
	parser = argparse.ArgumentParser(description='sync blocks from netowrk')
	parser.add_argument('--nem-node', help='NEM node(local) url', default='http://localhost:7890')
	return parser.parse_args()

async def main():
    args = parse_args()

    nem_client = NemClient(args.nem_node)

    with Databases() as databases:
        databases.nem.create_tables()

        dbHeight = databases.nem.get_current_height()
        chainHeight = await nem_client.height()

        # save Nemenesis Block
        if dbHeight == 0:
            block = await nem_client.get_block(1)
            databases.nem.add_block(block['height'], block['timeStamp'])
            dbHeight = block['height']

        # sync network blocks in database
        while chainHeight > dbHeight:

            blocks = await nem_client.get_blocks_after(dbHeight)

            for block in blocks['data']:
                databases.nem.add_block(block['block']['height'], block['block']['timeStamp'])

            dbHeight = blocks['data'][-1]['block']['height']

            print(f"added block height from {blocks['data'][0]['block']['height']} - {blocks['data'][-1]['block']['height']}")

        if (chainHeight == dbHeight):
            print("Database is up to date")

if __name__ == "__main__":
    run(main())
