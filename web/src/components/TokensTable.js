import React, { useEffect, useState } from 'react';
import { Button, Form, Label, Pagination, Table } from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import { API, copy, showError, showSuccess, timestamp2string } from '../helpers';

import { ITEMS_PER_PAGE } from '../constants';

function renderTimestamp(timestamp) {
  return (
    <>
      {timestamp2string(timestamp)}
    </>
  );
}

const TokensTable = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);

  const loadTokens = async (startIdx) => {
    const res = await API.get(`/api/token/?p=${startIdx}`);
    const { success, message, data } = res.data;
    if (success) {
      if (startIdx === 0) {
        setTokens(data);
      } else {
        let newTokens = tokens;
        newTokens.push(...data);
        setTokens(newTokens);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const onPaginationChange = (e, { activePage }) => {
    (async () => {
      if (activePage === Math.ceil(tokens.length / ITEMS_PER_PAGE) + 1) {
        // In this case we have to load more data and then append them.
        await loadTokens(activePage - 1);
      }
      setActivePage(activePage);
    })();
  };

  useEffect(() => {
    loadTokens(0)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, []);

  const manageToken = async (id, action, idx) => {
    let data = { id };
    let res;
    switch (action) {
      case 'delete':
        res = await API.delete(`/api/token/${id}/`);
        break;
      case 'enable':
        data.status = 1;
        res = await API.put('/api/token/', data);
        break;
      case 'disable':
        data.status = 2;
        res = await API.put('/api/token/', data);
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess('操作成功完成！');
      let token = res.data.data;
      let newTokens = [...tokens];
      let realIdx = (activePage - 1) * ITEMS_PER_PAGE + idx;
      if (action === 'delete') {
        newTokens[realIdx].deleted = true;
      } else {
        newTokens[realIdx].status = token.status;
      }
      setTokens(newTokens);
    } else {
      showError(message);
    }
  };

  const renderStatus = (status) => {
    switch (status) {
      case 1:
        return <Label basic color='green'>已启用</Label>;
      case 2:
        return (
          <Label basic color='red'>
            已禁用
          </Label>
        );
      default:
        return (
          <Label basic color='grey'>
            未知状态
          </Label>
        );
    }
  };

  const searchTokens = async () => {
    if (searchKeyword === '') {
      // if keyword is blank, load files instead.
      await loadTokens(0);
      setActivePage(1);
      return;
    }
    setSearching(true);
    const res = await API.get(`/api/token/search?keyword=${searchKeyword}`);
    const { success, message, data } = res.data;
    if (success) {
      setTokens(data);
      setActivePage(1);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  const handleKeywordChange = async (e, { value }) => {
    setSearchKeyword(value.trim());
  };

  const sortToken = (key) => {
    if (tokens.length === 0) return;
    setLoading(true);
    let sortedTokens = [...tokens];
    sortedTokens.sort((a, b) => {
      return ('' + a[key]).localeCompare(b[key]);
    });
    if (sortedTokens[0].id === tokens[0].id) {
      sortedTokens.reverse();
    }
    setTokens(sortedTokens);
    setLoading(false);
  };

  return (
    <>
      <Form onSubmit={searchTokens}>
        <Form.Input
          icon='search'
          fluid
          iconPosition='left'
          placeholder='搜索令牌的 ID 和名称 ...'
          value={searchKeyword}
          loading={searching}
          onChange={handleKeywordChange}
        />
      </Form>

      <Table basic>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortToken('id');
              }}
            >
              ID
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortToken('name');
              }}
            >
              名称
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortToken('status');
              }}
            >
              状态
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortToken('created_time');
              }}
            >
              创建时间
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortToken('accessed_time');
              }}
            >
              访问时间
            </Table.HeaderCell>
            <Table.HeaderCell>操作</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {tokens
            .slice(
              (activePage - 1) * ITEMS_PER_PAGE,
              activePage * ITEMS_PER_PAGE
            )
            .map((token, idx) => {
              if (token.deleted) return <></>;
              return (
                <Table.Row key={token.id}>
                  <Table.Cell>{token.id}</Table.Cell>
                  <Table.Cell>{token.name ? token.name : '无'}</Table.Cell>
                  <Table.Cell>{renderStatus(token.status)}</Table.Cell>
                  <Table.Cell>{renderTimestamp(token.created_time)}</Table.Cell>
                  <Table.Cell>{renderTimestamp(token.accessed_time)}</Table.Cell>
                  <Table.Cell>
                    <div>
                      <Button
                        size={'small'}
                        positive
                        onClick={async () => {
                          if (await copy(token.key)) {
                            showSuccess('已复制到剪贴板！');
                          } else {
                            showError('复制失败！');
                          }
                        }}
                      >
                        复制
                      </Button>
                      <Button
                        size={'small'}
                        negative
                        onClick={() => {
                          manageToken(token.id, 'delete', idx);
                        }}
                      >
                        删除
                      </Button>
                      <Button
                        size={'small'}
                        onClick={() => {
                          manageToken(
                            token.id,
                            token.status === 1 ? 'disable' : 'enable',
                            idx
                          );
                        }}
                      >
                        {token.status === 1 ? '禁用' : '启用'}
                      </Button>
                      <Button
                        size={'small'}
                        as={Link}
                        to={'/token/edit/' + token.id}
                      >
                        编辑
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            })}
        </Table.Body>

        <Table.Footer>
          <Table.Row>
            <Table.HeaderCell colSpan='6'>
              <Button size='small' as={Link} to='/token/add' loading={loading}>
                添加新的令牌
              </Button>
              <Pagination
                floated='right'
                activePage={activePage}
                onPageChange={onPaginationChange}
                size='small'
                siblingRange={1}
                totalPages={
                  Math.ceil(tokens.length / ITEMS_PER_PAGE) +
                  (tokens.length % ITEMS_PER_PAGE === 0 ? 1 : 0)
                }
              />
            </Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
    </>
  );
};

export default TokensTable;
