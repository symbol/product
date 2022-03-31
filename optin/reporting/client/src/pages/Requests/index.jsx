import Table from "../../components/Table";
import React, { useState, useEffect } from "react";
import { TablePagination } from '@trendmicro/react-paginations';
import '@trendmicro/react-paginations/dist/react-paginations.css';
import config from "../../config";

const Requests = function () {
    const [requests, setRequests] = useState({
      data: [],
      pagination: {
        pageNumber: 1,
        pageSize: 25,
        totalRecord: 0
      },
    });

    const fetchOptinRequests = async ({pageSize = 25, pageNumber = 1}) => {
        return await fetch(`/api/requests?pageSize=${pageSize}&pageNumber=${pageNumber}`).then((res) => res.json());
    }

    const handlePageChange = async ({page, pageLength}) =>{
        const result = await fetchOptinRequests({
            pageNumber: page,
            pageSize: pageLength
        });

        setRequests(result);
    }


    useEffect(() => {
      const getOptinRequests = async () => {
        const result = await fetchOptinRequests({
            pageNumber: 1
        });
        setRequests(result);
      };

      getOptinRequests();
    }, []);

    return (
        <>
            <Table
                dataList={requests}
                formatting={config}
            />
            <TablePagination
              className='pagination'
              type="full"
              page={requests.pagination.pageNumber}
              pageLength={requests.pagination.pageSize}
              totalRecords={requests.pagination.totalRecord}
              onPageChange={handlePageChange}
              prevPageRenderer={() => <i className="arrow left" />}
              nextPageRenderer={() => <i className="arrow right" />}
            />
        </>

    );
  };

  export default Requests;
