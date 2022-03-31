import Table from "../../components/Table";
import React, { useState, useEffect } from "react";
import Pagination from "react-js-pagination";
import config from "../../config";

const Balances = function () {
    const [balances, setBalances] = useState({
      data: [],
      pagination: {
        pageNumber: 1,
        pageSize: 25,
        totalRecord: 0
      },
    });

    const fetchBalances = async ({pageSize = 25, pageNumber = 1}) => {
        return await fetch(`/api/balances?pageSize=${pageSize}&pageNumber=${pageNumber}`).then((res) => res.json());
    }

    const handlePageChange = async (pageNumber) =>{
        const result = await fetchBalances({
            pageNumber
        });

        setBalances(result);
    }


    useEffect(() => {
      const getBalances = async () => {
        const result = await fetchBalances({
            pageNumber: 1
        });
        setBalances(result);
      };

      getBalances();
    }, []);

    return (
        <>
            <Table
                dataList={balances}
                formatting={config}
            />
            <Pagination
                activePage={balances.pagination.pageNumber}
                itemsCountPerPage={balances.pagination.pageSize}
                totalItemsCount={balances.pagination.totalRecord}
                pageRangeDisplayed={5}
                onChange={handlePageChange}
            />
        </>

    );
  };

  export default Balances;
