import React, { useMemo, useState, useRef } from 'react';
import { Graphin } from '@antv/graphin';

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
    const [hoveredHyperedge, setHoveredHyperedge] = useState(null);
    const [hyperedgeTooltip, setHyperedgeTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
    const graphRef = useRef(null);
    
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
                const createStyle = (baseColor, edgeKey) => {
                    const isHovered = hoveredHyperedge === edgeKey;
                    return {
                        fill: isHovered ? baseColor + 'CC' : baseColor + '33',
                        stroke: isHovered ? baseColor : baseColor + 'AA',
                        lineWidth: isHovered ? 3 : 2,
                        opacity: isHovered ? 1 : 0.7,
                        cursor: 'pointer',
                        // 添加阴影效果
                        shadowColor: isHovered ? baseColor : 'transparent',
                        shadowBlur: isHovered ? 10 : 0,
                        labelFill: '#fff',
                        labelPadding: 2,
                        labelBackgroundFill: baseColor,
                        labelBackgroundRadius: 5,
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
                    };
                };

                // 添加超边
                const edgeKeys = Object.keys(convertedData.edges);
                for (let i = 0; i < edgeKeys.length; i++) {
                    const key = edgeKeys[i];
                    const edge = convertedData.edges[key];
                    const nodes = key.split('|#|');

                    plugins.push({
                        key: `bubble-sets-${key}`,
                        type: 'bubble-sets',
                        members: nodes,
                        // labelText: String(edge.keywords || ''), // 确保labelText是字符串
                        // 存储超边信息
                        data: {
                            edgeKey: key,
                            ...edge
                        },
                        ...createStyle(colors[i % colors.length], key),
                    });
                }
            }

            // 添加tooltip插件
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
            // 添加事件监听
            onReady: (graph) => {
                graphRef.current = graph;

                if (mode === 'hyper') {
                    // 监听canvas鼠标移动事件
                    graph.on('canvas:mousemove', (e) => {
                        handleCanvasMouseMove(e);
                    });

                    graph.on('canvas:mouseleave', () => {
                        setHoveredHyperedge(null);
                        setHyperedgeTooltip({ visible: false, x: 0, y: 0, content: '' });
                    });
                }
            },
        };
    }, [convertedData, showTooltip, mode, hoveredHyperedge]);

    // 处理画布鼠标移动事件
    const handleCanvasMouseMove = (e) => {
        if (!convertedData || !graphRef.current) return;

        const point = { x: e.x, y: e.y };
        const edgeKeys = Object.keys(convertedData.edges);
        
        // 检查每个超边的包围区域
        let foundHyperedge = null;
        
        for (const edgeKey of edgeKeys) {
            const nodes = edgeKey.split('|#|');
            const nodePositions = nodes.map(nodeId => {
                const node = graphRef.current.getNodeData(nodeId);
                if (node) {
                    return graphRef.current.getElementPosition(nodeId);
                }
                return null;
            }).filter(pos => pos !== null);

            // 简单的包围盒检测
            if (nodePositions.length >= 2) {
                const minX = Math.min(...nodePositions.map(p => p.x)) - 50;
                const maxX = Math.max(...nodePositions.map(p => p.x)) + 50;
                const minY = Math.min(...nodePositions.map(p => p.y)) - 50;
                const maxY = Math.max(...nodePositions.map(p => p.y)) + 50;

                if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
                    foundHyperedge = edgeKey;
                    break;
                }
            }
        }

        if (foundHyperedge !== hoveredHyperedge) {
            setHoveredHyperedge(foundHyperedge);
            
            if (foundHyperedge) {
                const edge = convertedData.edges[foundHyperedge];
                const nodes = foundHyperedge.split('|#|');
                
                // 生成更详细的tooltip内容
                let nodeDetails = nodes.map(nodeId => {
                    const vertex = convertedData.vertices[nodeId];
                    if (vertex) {
                        return `<li>${nodeId}${vertex.entity_type ? ` (${vertex.entity_type})` : ''}</li>`;
                    }
                    return `<li>${nodeId}</li>`;
                }).join('');

                setHyperedgeTooltip({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    content: `
                        <div style="padding: 12px; max-width: 350px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 15px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px;">超边信息</h4>
                            <div style="margin: 8px 0;">
                                <strong style="color: #ffa726;">包含实体 (${nodes.length}):</strong>
                                <ul style="margin: 4px 0 8px 20px; padding: 0; list-style: circle;">
                                    ${nodeDetails}
                                </ul>
                            </div>
                            ${edge.keywords ? `<p style="margin: 6px 0;"><strong style="color: #66bb6a;">关键词:</strong> ${edge.keywords}</p>` : ''}
                            ${edge.description ? `<p style="margin: 6px 0;"><strong style="color: #42a5f5;">描述:</strong> ${edge.description.substring(0, 100)}${edge.description.length > 100 ? '...' : ''}</p>` : ''}
                            ${edge.weight !== undefined ? `<p style="margin: 6px 0;"><strong style="color: #ab47bc;">权重:</strong> ${edge.weight}</p>` : ''}
                        </div>
                    `
                });
            } else {
                setHyperedgeTooltip({ visible: false, x: 0, y: 0, content: '' });
            }
        }
    };

    // 如果没有数据，不显示组件
    if (!convertedData || (!entities.length && !hyperedges.length)) {
        return null;
    }

    return (
        <>
            <div style={{ height, width, ...containerStyle }}>
                <div style={{
                    marginBottom: '8px',
                    fontSize: '14px',
                    color: '#666',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>检索结果可视化 - {mode}</span>
                    <span style={{ fontSize: '12px' }}>
                        {edgesName}: {hyperedges.length}
                    </span>
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
            </div>
            {/* 自定义超边tooltip */}
            {mode === 'hyper' && hyperedgeTooltip.visible && (
                <div
                    style={{
                        position: 'fixed',
                        left: hyperedgeTooltip.x + 10,
                        top: hyperedgeTooltip.y - 10,
                        background: 'rgba(0, 0, 0, 0.9)',
                        color: 'white',
                        borderRadius: '8px',
                        padding: '4px',
                        pointerEvents: 'none',
                        zIndex: 9999,
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        maxHeight: '300px',
                        overflow: 'auto',
                    }}
                    dangerouslySetInnerHTML={{ __html: hyperedgeTooltip.content }}
                />
            )}
        </>
    );
};

export default RetrievalHyperGraph;