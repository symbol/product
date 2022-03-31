import Table from "../../components/Table";
import React, { useState, useEffect } from "react";
import Pagination from "react-js-pagination";
import config from "../../config";

const Completed = function () {
    const [completed, setCompleted] = useState({
      data: [],
      pagination: {
        pageNumber: 1,
        pageSize: 25,
        totalRecord: 0
      },
    });

    const fetchCompleted = async ({pageSize = 25, pageNumber = 1}) => {
        return await fetch(`/api/completed?pageSize=${pageSize}&pageNumber=${pageNumber}`).then((res) => res.json());
    }

    const handlePageChange = async (pageNumber) =>{
        const result = await fetchCompleted({
            pageNumber
        });

        setCompleted(result);
    }


    useEffect(() => {
      const getCompleted = async () => {
        const result = await fetchCompleted({
            pageNumber: 1
        });
        setCompleted(result);
      };

      getCompleted();
    }, []);

    return (
        <>
            <Table
                dataList={completed}
                formatting={config}
            />
            <Pagination
                activePage={completed.pagination.pageNumber}
                itemsCountPerPage={completed.pagination.pageSize}
                totalItemsCount={completed.pagination.totalRecord}
                pageRangeDisplayed={5}
                onChange={handlePageChange}
            />
        </>

    );
  };

  export default Completed;
