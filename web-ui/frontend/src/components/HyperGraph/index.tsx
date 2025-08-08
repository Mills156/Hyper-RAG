import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import { Spin, message, Card, Button, List } from 'antd';
import { InfoCircleOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000';

const colors = [
    '#F6BD16',
    '#00C9C9',
    '#F08F56',
    '#D580FF',
    '#FF3D00',
    '#16f69c',
    '#004ac9',
    '#f056d1',
    '#a680ff',
    '#c8ff00',
];

const entityTypeColors = {
    'PERSON': '#00C9C9',
    'CONCEPT': '#a68fff',
    'ORGANIZATION': '#F08F56',
    'LOCATION': '#16f69c',
    'EVENT': '#004ac9',
    'PRODUCT': '#f056d1',
}

const HyperGraph = ({
    vertexId,
    database,
    height = '400px',
    width = '100%',
    showTooltip = true,
    containerStyle = {},
    graphId = 'hypergraph-viewer'
}) => {
    const [data, setData] = useState(undefined);
    const [loading, setLoading] = useState(false);
    const [selectedHyperedge, setSelectedHyperedge] = useState(null);
    const [showHyperedgePanel, setShowHyperedgePanel] = useState(false);
    const [hyperedgeList, setHyperedgeList] = useState([]);
    const graphRef = useRef(null);

    // 获取vertex邻居数据
    const fetchVertexNeighbor = async (vId, db) => {
        if (!vId) {
return;
}

        setLoading(true);
        try {
            const url = db
                ? `${SERVER_URL}/db/vertices_neighbor/${encodeURIComponent(vId)}?database=${encodeURIComponent(db)}`
                : `${SERVER_URL}/db/vertices_neighbor/${encodeURIComponent(vId)}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API failed: ${response.status}`);
            }
            const neighborData = await response.json();
            setData(neighborData);
            
            // 生成超边列表
            if (neighborData.edges) {
                const edges = Object.keys(neighborData.edges).map((key, index) => ({
                    key,
                    data: neighborData.edges[key],
                    color: colors[index % colors.length],
                    nodes: key.split('|#|')
                }));
                setHyperedgeList(edges);
            }
        } catch (error) {
            console.error('Failed to fetch vertex neighbor:', error);
            message.error(`获取图数据失败: ${error.message}`);
        }
        setLoading(false);
    };

    // 选择超边
    const handleSelectHyperedge = (edge) => {
        setSelectedHyperedge(edge);
    };

    // 切换超边面板显示
    const toggleHyperedgePanel = () => {
        setShowHyperedgePanel(!showHyperedgePanel);
    };

    useEffect(() => {
        if (vertexId) {
            fetchVertexNeighbor(vertexId, database);
        }
    }, [vertexId, database]);

    const options = useMemo(() => {
        const hyperData = {
            nodes: [],
            edges: [],
        };
        const plugins = [];

        if (data) {
            // 添加顶点
            for (const key in data.vertices) {
                hyperData.nodes.push({
                    id: key,
                    label: key,
                    ...data.vertices[key],
                });
            }

            // 创建样式函数
            const createStyle = (baseColor, isSelected = false) => ({
                fill: isSelected ? `${baseColor}cc` : `${baseColor}66`,
                stroke: isSelected ? baseColor : `${baseColor}88`,
                strokeWidth: isSelected ? 4 : 2,
                labelFill: isSelected ? '#000' : '#666',
                labelFontSize: isSelected ? 14 : 12,
                labelPadding: 4,
                labelBackgroundFill: isSelected ? baseColor : `${baseColor}cc`,
                labelBackgroundRadius: 6,
                labelPlacement: 'center',
                labelAutoRotate: false,
                // bubblesets配置
                maxRoutingIterations: 100,
                maxMarchingIterations: 20,
                pixelGroup: 4,
                edgeR0: 10,
                edgeR1: 60,
                nodeR0: 15,
                nodeR1: 50,
                morphBuffer: 10,
                threshold: 4,
                memberInfluenceFactor: 1,
                edgeInfluenceFactor: 4,
                nonMemberInfluenceFactor: -0.8,
                virtualEdges: true,
            });

            // 添加超边
            const edgeKeys = Object.keys(data.edges);
            for (let i = 0; i < edgeKeys.length; i++) {
                const key = edgeKeys[i];
                const edge = data.edges[key];
                const nodes = key.split('|#|');
                const isSelected = selectedHyperedge && selectedHyperedge.key === key;
                const baseColor = colors[i % colors.length];

                plugins.push({
                    key: `bubble-sets-${key}`,
                    type: 'bubble-sets',
                    members: nodes,
                    labelText: isSelected && edge.keywords ? edge.keywords.slice(0, 15) + (edge.keywords.length > 15 ? '...' : '') : '',
                    ...createStyle(baseColor, isSelected),
                });
            }

            // 添加节点tooltip插件
            if (showTooltip) {
                plugins.push({
                    type: 'tooltip',
                    getContent: (e, items) => {
                        let result = '';
                        items.forEach((item) => {
                            result += `<h4>${item.id}</h4>`;
                            if (item.entity_type) {
                                result += `<p><strong>类型:</strong> ${item.entity_type}</p>`;
                            }
                            if (item.description) {
                                result += `<p><strong>描述:</strong> ${item.description.split('<SEP>').slice(0, 2).join('；')}</p>`;
                            }
                        });
                        return result;
                    },
                });
            }
        }

        return {
            autoResize: true,
            data: hyperData,
            node: {
                palette: { field: 'cluster' },
                style: {
                    size: 25,
                    labelText: d => d.id,
                    fill: d => {
                        // 如果是当前查看的顶点，使用红色高亮
                        if (d.id === vertexId) {
                            return 'black';
                        }
                        // 根据entity_type设置不同颜色
                        if (d.entity_type) {
                            return entityTypeColors[d.entity_type] || '#8566CC' ;
                        }
                        // 默认颜色
                        return '#8566CC';
                    },
                }
            },
            edge: {
                style: {
                    size: 2,
                }
            },
            animate: false,
            behaviors: [
                'zoom-canvas',
                'drag-canvas',
                'drag-element',
            ],
            autoFit: 'center',
            layout: {
                type: 'force',
                clustering: true,
                preventOverlap: true,
                nodeClusterBy: 'entity_type',
                gravity: 20,
                linkDistance: 150,
            },
            plugins,
        };
    }, [data, vertexId, showTooltip, selectedHyperedge]);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height,
                ...containerStyle
            }}>
                <Spin size="large" tip="加载超图数据中..." />
            </div>
        );
    }

    if (!data || !vertexId) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height,
                color: '#999',
                ...containerStyle
            }}>
                {!vertexId ? '请选择一个顶点' : '暂无图数据'}
            </div>
        );
    }

    return (
        <div style={{ height, width, ...containerStyle, position: 'relative' }}>
            {/* 超边控制按钮 */}
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 1000,
                display: 'flex',
                gap: '8px'
            }}>
                <Button
                    type="primary"
                    icon={showHyperedgePanel ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={toggleHyperedgePanel}
                    size="small"
                >
                    {showHyperedgePanel ? '隐藏' : '显示'}超边信息
                </Button>
            </div>

            <Graphin
                ref={graphRef}
                options={options}
                id={graphId}
                style={{ width: '100%', height: '100%' }}
                error={() => {
                    return <div>
                        <div>

                        </div>
                    </div>
                }}
            />

            {/* 超边信息面板 */}
            {showHyperedgePanel && (
                <div style={{
                    position: 'absolute',
                    top: '50px',
                    right: '10px',
                    width: '300px',
                    maxHeight: '60%',
                    backgroundColor: 'white',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    overflow: 'hidden'
                }}>
                    <Card
                        title={
                            <span>
                                <InfoCircleOutlined style={{ marginRight: '8px' }} />
                                超边列表 ({hyperedgeList.length})
                            </span>
                        }
                        size="small"
                        style={{ height: '100%' }}
                        bodyStyle={{ padding: '12px', maxHeight: '400px', overflow: 'auto' }}
                    >
                        <List
                            dataSource={hyperedgeList}
                            size="small"
                            renderItem={(edge, index) => (
                                <List.Item
                                    style={{
                                        cursor: 'pointer',
                                        backgroundColor: selectedHyperedge?.key === edge.key ? '#e6f7ff' : 'transparent',
                                        borderRadius: '4px',
                                        margin: '4px 0',
                                        padding: '8px',
                                        border: selectedHyperedge?.key === edge.key ? '1px solid #1890ff' : '1px solid transparent'
                                    }}
                                    onClick={() => handleSelectHyperedge(edge)}
                                >
                                    <div style={{ width: '100%' }}>
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            marginBottom: '4px' 
                                        }}>
                                            <div
                                                style={{
                                                    width: '12px',
                                                    height: '12px',
                                                    backgroundColor: edge.color,
                                                    borderRadius: '2px',
                                                    marginRight: '8px',
                                                    border: '1px solid rgba(0,0,0,0.1)'
                                                }}
                                            />
                                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                                超边 {index + 1}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                                            节点: {edge.nodes.join(' • ')}
                                        </div>
                                        {edge.data.keywords && (
                                            <div style={{ fontSize: '11px', color: '#1890ff' }}>
                                                关键词: {edge.data.keywords.slice(0, 30)}...
                                            </div>
                                        )}
                                    </div>
                                </List.Item>
                            )}
                        />
                        
                        {selectedHyperedge && (
                            <Card 
                                size="small" 
                                title="选中超边详情" 
                                style={{ marginTop: '12px' }}
                                bodyStyle={{ padding: '8px' }}
                            >
                                <div style={{ fontSize: '12px' }}>
                                    <div style={{ marginBottom: '6px' }}>
                                        <strong>包含节点:</strong><br/>
                                        <span style={{ color: '#1890ff' }}>
                                            {selectedHyperedge.nodes.join(' • ')}
                                        </span>
                                    </div>
                                    {selectedHyperedge.data.keywords && (
                                        <div style={{ marginBottom: '6px' }}>
                                            <strong>关键词:</strong><br/>
                                            <span style={{ color: '#52c41a' }}>
                                                {selectedHyperedge.data.keywords}
                                            </span>
                                        </div>
                                    )}
                                    {selectedHyperedge.data.description && (
                                        <div style={{ marginBottom: '6px' }}>
                                            <strong>描述:</strong><br/>
                                            <span style={{ color: '#722ed1' }}>
                                                {selectedHyperedge.data.description}
                                            </span>
                                        </div>
                                    )}
                                    {selectedHyperedge.data.weight && (
                                        <div>
                                            <strong>权重:</strong> 
                                            <span style={{ color: '#fa8c16' }}>
                                                {selectedHyperedge.data.weight}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
};

export default HyperGraph;