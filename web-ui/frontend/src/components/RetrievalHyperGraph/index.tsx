import React, { useMemo, useState, useEffect } from 'react';
import { Graphin } from '@antv/graphin';
import { Card, Button, List } from 'antd';
import { InfoCircleOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';

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


//  colors 加深
const entityTypeColors = {
    'PERSON': '#00C9C9',
    'CONCEPT': '#a68fff',
    'ORGANIZATION': '#F08F56',
    'LOCATION': '#16f69c',
    'EVENT': '#004ac9',
    'PRODUCT': '#f056d1',
}

const RetrievalHyperGraph = ({
    entities = [],
    hyperedges = [],
    height = '300px',
    width = '100%',
    showTooltip = true,
    containerStyle = {},
    graphId = 'retrieval-hypergraph',
    mode = 'hyper' // 新增mode参数，默认为hyper模式
}) => {
    const edgesName = mode === 'hyper' ? '超边' : '边'
    const [selectedHyperedge, setSelectedHyperedge] = useState(null);
    const [showHyperedgePanel, setShowHyperedgePanel] = useState(false);
    const [hyperedgeList, setHyperedgeList] = useState([]);

    // 选择超边
    const handleSelectHyperedge = (edge) => {
        setSelectedHyperedge(edge);
    };

    // 切换超边面板显示
    const toggleHyperedgePanel = () => {
        setShowHyperedgePanel(!showHyperedgePanel);
    };

    // 转换数据格式为HyperGraph组件需要的格式
    const convertedData = useMemo(() => {
        // 如果没有数据，返回空
        if (!entities.length && !hyperedges.length) {
            return null;
        }

        const vertices = {};
        const edges = {};

        // 处理实体数据
        entities.forEach(entity => {
            const entityName = String(entity.entity_name || entity.name || `Entity_${Math.random()}`);
            vertices[entityName] = {
                ...entity,
                entity_type: String(entity.entity_type || 'Unknown'),
                description: String(entity.description || ''),
                label: String(entity.entity_name || entity.name || ''),
            };
        });

        // 处理超边数据
        hyperedges.forEach((edge, index) => {
            // 构建超边的键名，使用|#|分隔实体
            let edgeKey;
            if (Array.isArray(edge.entity_set)) {
                edgeKey = edge.entity_set.map(e => String(e)).join('|#|');
            } else if (typeof edge.entity_set === 'string') {
                edgeKey = edge.entity_set;
            } else if (edge.id_set) {
                // 如果没有entity_set但有id_set，使用id_set
                edgeKey = Array.isArray(edge.id_set) ? edge.id_set.map(e => String(e)).join('|#|') : String(edge.id_set);
            } else {
                edgeKey = `edge_${index}`;
            }

            // 确保超边中的实体也在vertices中
            const entityNames = edgeKey.split('|#|');
            entityNames.forEach(entityName => {
                if (!vertices[entityName]) {
                    vertices[entityName] = {
                        entity_type: 'Unknown',
                        description: `Entity from hyperedge: ${entityName}`
                    };
                }
            });

            edges[edgeKey] = {
                keywords: String(edge.keywords || edge.description || ''),
                description: String(edge.description || ''),
                weight: edge.weight || 1,
                ...edge
            };
        });

        return { vertices, edges };
    }, [entities, hyperedges]);

    // 生成超边列表
    useEffect(() => {
        if (convertedData && convertedData.edges && mode === 'hyper') {
            const edges = Object.keys(convertedData.edges).map((key, index) => ({
                key,
                data: convertedData.edges[key],
                color: colors[index % colors.length],
                nodes: key.split('|#|')
            }));
            setHyperedgeList(edges);
        } else {
            setHyperedgeList([]);
        }
    }, [convertedData, mode]);

    const options = useMemo(() => {
        const hyperData = {
            nodes: [],
            edges: [],
        };
        const plugins = [];

        if (convertedData) {
            // 添加顶点
            for (const key in convertedData.vertices) {
                hyperData.nodes.push({
                    ...convertedData.vertices[key],
                    id: key,
                    label: String(key), // 确保label是字符串
                });
            }

            if (mode === 'graph') {
                // graph模式：设置标准边格式，不使用plugins
                const edgeKeys = Object.keys(convertedData.edges);
                for (let i = 0; i < edgeKeys.length; i++) {
                    const key = edgeKeys[i];
                    const nodes = key.split('|#|');

                    // 为每对节点创建边
                    for (let j = 0; j < nodes.length; j++) {
                        for (let k = j + 1; k < nodes.length; k++) {
                            hyperData.edges.push({
                                source: nodes[j],
                                target: nodes[k],
                                ...convertedData.edges[key]
                            });
                        }
                    }
                }
            } else {
                // hyper模式：使用原有的bubble-sets插件
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
                const edgeKeys = Object.keys(convertedData.edges);
                for (let i = 0; i < edgeKeys.length; i++) {
                    const key = edgeKeys[i];
                    const edge = convertedData.edges[key];
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
            }

            // 添加节点tooltip插件
            if (showTooltip) {
                plugins.push({
                    type: 'tooltip',
                    getContent: (e, items) => {
                        let result = '';
                        items.forEach((item) => {
                            result += `<h4>${String(item.id)}</h4>`;
                            if (item.entity_type) {
                                result += `<p><strong>类型:</strong> ${String(item.entity_type)}</p>`;
                            }
                            if (item.description) {
                                const desc = String(item.description);
                                result += `<p><strong>描述:</strong> ${desc.split('<SEP>').slice(0, 2).join('；')}</p>`;
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
                    size: mode === 'graph' ? 20 : 25,
                    labelText: d => d.id,
                    fill: d => {

                        // 根据entity_type设置不同颜色
                        if (d.entity_type) {
                            return entityTypeColors[d.entity_type] || '#8566CC';
                        }
                        // 默认颜色
                        return '#8566CC';
                    },
                },
            },
            edge: {
                style: {
                    stroke: '#a68fff', // 边的颜色
                    lineWidth: 3,
                }
            },
            animate: false,
            behaviors: [
                'zoom-canvas',
                'drag-canvas',
                'drag-element',
            ],
            autoFit: 'view',
            layout: {
                type: 'force-atlas2',
                // clustering: true,
                preventOverlap: true,
                // nodeClusterBy: 'entity_type',
                kr: mode === 'graph' ? 5 : 80,
                gravity: 20,
                linkDistance: 10,
            },
            plugins: mode === 'graph' ? (showTooltip ? plugins : []) : plugins,
        };
    }, [convertedData, showTooltip, mode, selectedHyperedge]);

    // 如果没有数据，不显示组件
    if (!convertedData || (!entities.length && !hyperedges.length)) {
        return null;
    }

    return (
        <div style={{ height, width, ...containerStyle, position: 'relative' }}>
            <div style={{
                marginBottom: '8px',
                fontSize: '14px',
                color: '#666',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span>检索结果可视化 - {mode}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px' }}>
                        {edgesName}: {hyperedges.length}
                    </span>
                    {mode === 'hyper' && hyperedges.length > 0 && (
                        <Button
                            type="primary"
                            icon={showHyperedgePanel ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                            onClick={toggleHyperedgePanel}
                            size="small"
                        >
                            {showHyperedgePanel ? '隐藏' : '显示'}超边
                        </Button>
                    )}
                </div>
            </div>
            <Graphin
                options={options}
                id={graphId}
                style={{
                    width: '100%',
                    height: 'calc(100% - 30px)',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px'
                }}
                error={() => {
                    return (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '100%',
                            color: '#999'
                        }}>
                            图表加载失败
                        </div>
                    );
                }}
            />

            {/* 超边信息面板 */}
            {showHyperedgePanel && mode === 'hyper' && hyperedgeList.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '40px',
                    right: '10px',
                    width: '280px',
                    maxHeight: '65%',
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
                        bodyStyle={{ padding: '12px', maxHeight: '350px', overflow: 'auto' }}
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
                                        padding: '6px',
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
                                                    width: '10px',
                                                    height: '10px',
                                                    backgroundColor: edge.color,
                                                    borderRadius: '2px',
                                                    marginRight: '6px',
                                                    border: '1px solid rgba(0,0,0,0.1)'
                                                }}
                                            />
                                            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                                                超边 {index + 1}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '3px' }}>
                                            节点: {edge.nodes.slice(0, 3).join(' • ')}{edge.nodes.length > 3 ? '...' : ''}
                                        </div>
                                        {edge.data.keywords && (
                                            <div style={{ fontSize: '10px', color: '#1890ff' }}>
                                                关键词: {edge.data.keywords.slice(0, 25)}...
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
                                <div style={{ fontSize: '11px' }}>
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

export default RetrievalHyperGraph;