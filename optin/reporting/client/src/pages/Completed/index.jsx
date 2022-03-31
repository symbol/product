import Table from "../../components/Table";
import React, { useState, useEffect } from "react";
import { TablePagination } from '@trendmicro/react-paginations';
import '@trendmicro/react-paginations/dist/react-paginations.css';
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

    const handlePageChange = async ({page, pageLength}) =>{
        const result = await fetchCompleted({
            pageNumber: page,
            pageSize: pageLength
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
            <TablePagination
              className='pagination'
              type="full"
              page={completed.pagination.pageNumber}
              pageLength={completed.pagination.pageSize}
              totalRecords={completed.pagination.totalRecord}
              onPageChange={handlePageChange}
              prevPageRenderer={() => <i className="arrow left" />}
              nextPageRenderer={() => <i className="arrow right" />}
            />
        </>

    );
  };

  export default Completed;
