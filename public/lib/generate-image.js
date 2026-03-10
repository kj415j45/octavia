// Constants for popularity and rating thresholds
const POPULARITY_THRESHOLDS = {
    HIGH: 10000,
    MEDIUM: 2000,
    LOW: 500
};

const RATING_THRESHOLDS = {
    EXCELLENT: 90,
    GOOD: 75,
    FAIR: 60
};

function getPopularityBadgeClass(hotScore) {
    if (hotScore === '--') return 'bg-secondary';
    if(hotScore.endsWith('万')) {
        hotScore = parseFloat(hotScore.replace('万', '')) * 10000;
    }
    const score = parseInt(hotScore);
    if (score >= POPULARITY_THRESHOLDS.HIGH) return 'bg-danger';
    if (score >= POPULARITY_THRESHOLDS.MEDIUM) return 'bg-warning';
    if (score >= POPULARITY_THRESHOLDS.LOW) return 'bg-primary';
    return 'bg-success';
}

function getRatingBadgeClass(goodRate) {
    if (goodRate === '--') return 'bg-secondary';
    const rate = parseFloat(goodRate.replace('%', ''));
    if (rate >= RATING_THRESHOLDS.EXCELLENT) return 'bg-success';
    if (rate >= RATING_THRESHOLDS.GOOD) return 'bg-primary';
    if (rate >= RATING_THRESHOLDS.FAIR) return 'bg-warning';
    return 'bg-danger';
}

async function generateStageImage(stages) {
    const button = document.getElementById('generateImageButton');
    const originalText = button.textContent;
    button.textContent = '生成中...';
    button.disabled = true;

    try {
        // Create container for the table
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.background = '#ffffff';
        container.style.padding = '40px';

        // Header info section
        const headerInfo = document.createElement('div');
        headerInfo.style.display = 'flex';
        headerInfo.style.justifyContent = 'space-between';
        headerInfo.style.marginBottom = '20px';
        headerInfo.style.fontSize = '14px';
        headerInfo.style.color = '#666';

        const countInfo = document.createElement('div');
        countInfo.textContent = `共 ${stages.length} 个`;
        headerInfo.appendChild(countInfo);

        const timeInfo = document.createElement('div');
        const now = new Date();
        const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const isoTime = beijingTime.toISOString().slice(0, 16).replace('T', ' ');
        timeInfo.textContent = `${isoTime} (UTC+8)`;
        headerInfo.appendChild(timeInfo);

        container.appendChild(headerInfo);

        // Create table
        const table = document.createElement('table');
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.fontSize = '14px';

        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['ID', '作者', '奇域名称', '热度', '好评率', '人数'].forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            th.style.padding = '12px 8px';
            th.style.textAlign = 'left';
            th.style.borderBottom = '2px solid #dee2e6';
            th.style.backgroundColor = '#f8f9fa';
            th.style.fontWeight = 'bold';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table body
        const tbody = document.createElement('tbody');
        stages.forEach((stage, index) => {
            const row = document.createElement('tr');
            const isRemoved = stage.status && stage.status.removed;
            if (isRemoved) {
                row.style.backgroundColor = '#fff5f5';
            } else if (index % 2 === 1) {
                row.style.backgroundColor = '#f8f9fa';
            }

            // ID column
            const idCell = document.createElement('td');
            idCell.textContent = stage.level.id;
            idCell.style.padding = '12px 8px';
            idCell.style.borderBottom = '1px solid #dee2e6';
            row.appendChild(idCell);

            // Author column
            const authorCell = document.createElement('td');
            authorCell.textContent = stage.author.game?.name || stage.author.mys?.name || stage.author.hyl?.name || '未知';
            authorCell.style.padding = '12px 8px';
            authorCell.style.borderBottom = '1px solid #dee2e6';
            row.appendChild(authorCell);

            // Name and tags column
            const nameCell = document.createElement('td');
            nameCell.style.padding = '12px 8px';
            nameCell.style.borderBottom = '1px solid #dee2e6';
            
            const nameDiv = document.createElement('div');
            nameDiv.style.marginBottom = '4px';
            
            const nameText = document.createElement('span');
            nameText.textContent = stage.level.meta.name;
            nameDiv.appendChild(nameText);

            // Add version number if available
            if (stage.level?.version?.latest) {
                const versionSpan = document.createElement('span');
                versionSpan.textContent = `   v${stage.level.version.latest}`;
                versionSpan.style.fontSize = '11px';
                versionSpan.style.color = '#999';
                nameDiv.appendChild(versionSpan);
            }

            nameCell.appendChild(nameDiv);

            // Add badges (type, category, then tags)
            const badgesDiv = document.createElement('div');

            // Category badge
            const categoryBadge = document.createElement('span');
            categoryBadge.textContent = stage.level.meta.category;
            categoryBadge.style.display = 'inline-block';
            categoryBadge.style.padding = '2px 8px';
            categoryBadge.style.marginRight = '4px';
            categoryBadge.style.fontSize = '12px';
            categoryBadge.style.color = '#ffffff';
            categoryBadge.style.borderRadius = '4px';
            if (stage.level.meta.category === '轻量趣味') {
                categoryBadge.style.backgroundColor = '#198754';
            } else if (stage.level.meta.category === '长线游玩') {
                categoryBadge.style.backgroundColor = '#ffc107';
            } else {
                categoryBadge.style.backgroundColor = '#6c757d';
            }
            badgesDiv.appendChild(categoryBadge);

            // Type badge
            const typeBadge = document.createElement('span');
            typeBadge.textContent = stage.level.meta.type;
            typeBadge.style.display = 'inline-block';
            typeBadge.style.padding = '2px 8px';
            typeBadge.style.marginRight = '4px';
            typeBadge.style.fontSize = '12px';
            typeBadge.style.backgroundColor = '#6c757d';
            typeBadge.style.color = '#ffffff';
            typeBadge.style.borderRadius = '4px';
            badgesDiv.appendChild(typeBadge);

            // Tags
            if (stage.level.meta.tags && stage.level.meta.tags.length > 0) {
                stage.level.meta.tags.forEach(tag => {
                    const badge = document.createElement('span');
                    badge.textContent = tag;
                    badge.style.display = 'inline-block';
                    badge.style.padding = '2px 8px';
                    badge.style.marginRight = '4px';
                    badge.style.fontSize = '12px';
                    badge.style.backgroundColor = '#0d6efd';
                    badge.style.color = '#ffffff';
                    badge.style.borderRadius = '4px';
                    badgesDiv.appendChild(badge);
                });
            }
            nameCell.appendChild(badgesDiv);
            row.appendChild(nameCell);

            // Popularity column (right-aligned)
            const popularityCell = document.createElement('td');
            popularityCell.style.padding = '12px 8px';
            popularityCell.style.borderBottom = '1px solid #dee2e6';
            popularityCell.style.textAlign = 'right';
            
            const popularityBadge = document.createElement('span');
            popularityBadge.textContent = stage.level.meta.hotScore;
            popularityBadge.style.display = 'inline-block';
            popularityBadge.style.padding = '4px 8px';
            popularityBadge.style.fontSize = '12px';
            popularityBadge.style.color = '#ffffff';
            popularityBadge.style.borderRadius = '4px';
            const popClass = getPopularityBadgeClass(stage.level.meta.hotScore);
            const popColors = {
                'bg-danger': '#dc3545',
                'bg-warning': '#ffc107',
                'bg-primary': '#0d6efd',
                'bg-success': '#198754',
                'bg-secondary': '#6c757d'
            };
            popularityBadge.style.backgroundColor = popColors[popClass];
            popularityCell.appendChild(popularityBadge);
            row.appendChild(popularityCell);

            // Rating column (left-aligned)
            const ratingCell = document.createElement('td');
            ratingCell.style.padding = '12px 8px';
            ratingCell.style.borderBottom = '1px solid #dee2e6';
            ratingCell.style.textAlign = 'left';
            
            const ratingBadge = document.createElement('span');
            ratingBadge.textContent = stage.level.meta.goodRate + ` (${stage.level.meta.comments})`;
            ratingBadge.style.display = 'inline-block';
            ratingBadge.style.padding = '4px 8px';
            ratingBadge.style.fontSize = '12px';
            ratingBadge.style.color = '#ffffff';
            ratingBadge.style.borderRadius = '4px';
            const rateClass = getRatingBadgeClass(stage.level.meta.goodRate);
            const rateColors = {
                'bg-success': '#198754',
                'bg-primary': '#0d6efd',
                'bg-warning': '#ffc107',
                'bg-danger': '#dc3545',
                'bg-secondary': '#6c757d'
            };
            ratingBadge.style.backgroundColor = rateColors[rateClass];
            ratingCell.appendChild(ratingBadge);
            row.appendChild(ratingCell);

            // Players column
            const playersCell = document.createElement('td');
            playersCell.style.padding = '12px 8px';
            playersCell.style.borderBottom = '1px solid #dee2e6';
            
            const playersBadge = document.createElement('span');
            playersBadge.textContent = `${stage.level.meta.players.str}人`;
            playersBadge.style.display = 'inline-block';
            playersBadge.style.padding = '4px 8px';
            playersBadge.style.fontSize = '12px';
            playersBadge.style.color = '#ffffff';
            playersBadge.style.borderRadius = '4px';
            
            let playerBgColor;
            if (stage.level.meta.players.str.startsWith('1')) {
                playerBgColor = stage.level.meta.players.str.startsWith('1-') ? '#0dcaf0' : '#198754';
            } else {
                playerBgColor = '#ffc107';
            }
            playersBadge.style.backgroundColor = playerBgColor;
            playersCell.appendChild(playersBadge);

            row.appendChild(playersCell);

            tbody.appendChild(row);

            // Apply red border to removed rows
            if (isRemoved) {
                Array.from(row.cells).forEach((cell, i) => {
                    cell.style.borderTop = '2px solid #dc3545';
                    cell.style.borderBottom = '2px solid #dc3545';
                    if (i === 0) cell.style.borderLeft = '2px solid #dc3545';
                    if (i === row.cells.length - 1) cell.style.borderRight = '2px solid #dc3545';
                });
            }
        });
        table.appendChild(tbody);

        container.appendChild(table);

        // Footer info section
        const footerInfo = document.createElement('div');
        footerInfo.style.textAlign = 'center';
        footerInfo.style.marginTop = '20px';
        footerInfo.style.fontSize = '12px';
        footerInfo.style.color = '#666';

        const footerText = document.createElement('span');
        footerText.textContent = 'Generated by ';
        footerInfo.appendChild(footerText);

        const repoLink = document.createElement('span');
        repoLink.textContent = 'kj415j45/octavia';
        repoLink.style.color = '#0d6efd';
        repoLink.style.fontWeight = 'bold';
        footerInfo.appendChild(repoLink);

        const footerText2 = document.createElement('span');
        footerText2.textContent = ' @ GitHub';
        footerInfo.appendChild(footerText2);

        container.appendChild(footerInfo);

        document.body.appendChild(container);

        // Generate image with html2canvas
        const canvas = await html2canvas(container, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false
        });

        // Remove temporary container
        document.body.removeChild(container);

        // Show preview modal
        showImagePreviewModal(canvas);

        button.textContent = originalText;
        button.disabled = false;

    } catch (error) {
        console.error('生成图片失败:', error);
        alert('生成图片失败，请稍后重试');
        button.textContent = originalText;
        button.disabled = false;
    }
}

function showImagePreviewModal(canvas) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';
    modal.style.cursor = 'default';

    const modalContent = document.createElement('div');
    modalContent.style.position = 'relative';
    modalContent.style.maxWidth = '90vw';
    modalContent.style.maxHeight = '90vh';
    modalContent.style.display = 'flex';
    modalContent.style.flexDirection = 'column';
    modalContent.style.alignItems = 'center';

    const imgPreview = document.createElement('img');
    imgPreview.src = canvas.toDataURL('image/png');
    imgPreview.className = 'img-fluid';
    imgPreview.style.maxWidth = '100%';
    imgPreview.style.maxHeight = 'calc(90vh - 80px)';
    imgPreview.style.objectFit = 'contain';
    imgPreview.style.cursor = 'default';
    imgPreview.style.marginBottom = '20px';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'd-flex gap-3';

    const copyButton = document.createElement('button');
    copyButton.textContent = '复制图片';
    copyButton.className = 'btn btn-success';
    copyButton.style.zIndex = '10001';
    copyButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            canvas.toBlob(async (blob) => {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                copyButton.textContent = '已复制';
                setTimeout(() => {
                    copyButton.textContent = '复制图片';
                }, 2000);
            }, 'image/png');
        } catch (err) {
            console.error('复制失败:', err);
            alert('复制失败，请尝试下载');
        }
    });

    const downloadButton = document.createElement('button');
    downloadButton.textContent = '下载图片';
    downloadButton.className = 'btn btn-primary';
    downloadButton.style.zIndex = '10001';
    downloadButton.addEventListener('click', (e) => {
        e.stopPropagation();
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `octavia-stages-${new Date().getTime()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            downloadButton.textContent = '已下载';
            setTimeout(() => {
                downloadButton.textContent = '下载图片';
            }, 2000);
        }, 'image/png');
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'btn btn-danger position-fixed';
    closeBtn.style.top = '20px';
    closeBtn.style.right = '20px';
    closeBtn.style.zIndex = '10001';
    closeBtn.style.width = '50px';
    closeBtn.style.height = '50px';
    closeBtn.style.fontSize = '1.5rem';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.body.removeChild(modal);
    });

    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(downloadButton);

    modalContent.appendChild(imgPreview);
    modalContent.appendChild(buttonContainer);
    modal.appendChild(modalContent);
    modal.appendChild(closeBtn);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    document.body.appendChild(modal);
}
