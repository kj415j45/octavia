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

async function generateStageImage(stages, options = {}) {
    const button = document.getElementById('generateImageButton');
    const originalText = button.textContent;
    button.textContent = '生成中...';
    button.disabled = true;

    const showRegion = options.showRegion === true;

    // Determine how region info should be displayed:
    // - single region across all stages  -> show once, centered at the top
    // - multiple regions                 -> show per row in the leftmost column
    const uniqueRegions = [...new Set(stages.map(stage => stage.level.region))];
    const showRegionOnTop = showRegion && uniqueRegions.length === 1;
    const showRegionPerRow = showRegion && uniqueRegions.length > 1;

    try {
        // Create container for the table
        const container = document.createElement('div');
        container.className = 'stage-image-export position-absolute bg-white';
        container.style.left = '-9999px';
        container.style.padding = '40px';

        // Header info section
        const headerInfo = document.createElement('div');
        headerInfo.className = 'd-flex justify-content-between mb-4 text-secondary';

        const countInfo = document.createElement('div');
        countInfo.textContent = `共 ${stages.length} 个`;
        countInfo.className = 'col';
        headerInfo.appendChild(countInfo);

        // Single-region title, shown centered in the header row
        if (showRegionOnTop) {
            const regionTitle = document.createElement('div');
            regionTitle.textContent = regionMap[uniqueRegions[0]]?.name || uniqueRegions[0] || '未知';
            regionTitle.className = 'col text-center fw-bold text-dark';
            headerInfo.appendChild(regionTitle);
        }

        const timeInfo = document.createElement('div');
        const now = new Date();
        const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const isoTime = beijingTime.toISOString().slice(0, 16).replace('T', ' ');
        timeInfo.textContent = `${isoTime} (UTC+8)`;
        timeInfo.className = 'col text-end';
        headerInfo.appendChild(timeInfo);

        container.appendChild(headerInfo);

        // Create table
        const table = document.createElement('table');
        table.className = 'table w-100 mb-0 align-middle';

        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const headers = ['ID', '作者', '奇域名称', '热度', '好评率', '人数'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            th.className = `py-3 px-2 bg-light border-bottom border-2 border-top-0 border-start-0 border-end-0 fw-bold ${headerText === '热度' ? 'text-end' : 'text-start'}`;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create table body
        const tbody = document.createElement('tbody');
        stages.forEach((stage, index) => {
            const row = document.createElement('tr');
            const isRemoved = stage.status && stage.status.removed;
            const isRemovedConfirmed = isRemoved && stage.status.upstream !== null;
            const isRemovedTimeout = isRemoved && stage.status.upstream === null;
            if (isRemovedConfirmed) {
                row.className = 'bg-danger bg-opacity-10';
            } else if (isRemovedTimeout) {
                row.className = 'bg-warning bg-opacity-10';
            } else if (index % 2 === 1) {
                row.className = 'bg-light';
            }

            // ID column
            const idCell = document.createElement('td');

            if (showRegionPerRow) {
                const regionText = regionMap[stage.level.region]?.name || stage.level.region || '未知';

                const regionLine = document.createElement('div');
                regionLine.textContent = regionText;
                regionLine.className = 'small text-secondary mb-1';

                const idLine = document.createElement('div');
                idLine.textContent = stage.level.id;
                idLine.className = 'fw-semibold';

                idCell.appendChild(regionLine);
                idCell.appendChild(idLine);
            } else {
                idCell.textContent = stage.level.id;
            }

            row.appendChild(idCell);

            // Author column
            const authorCell = document.createElement('td');
            authorCell.textContent = stage.author.game?.name || stage.author.mys?.name || stage.author.hyl?.name || '未知';
            row.appendChild(authorCell);

            // Name and tags column
            const nameCell = document.createElement('td');
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'mb-1';
            
            const nameText = document.createElement('span');
            nameText.textContent = stage.level.meta.name;
            nameDiv.appendChild(nameText);

            // Add version number if available
            if (stage.level?.version?.latest) {
                const versionSpan = document.createElement('span');
                versionSpan.textContent = `   v${stage.level.version.latest}`;
                versionSpan.className = 'small text-secondary';
                nameDiv.appendChild(versionSpan);
            }

            nameCell.appendChild(nameDiv);

            // Add badges (type, category, then tags)
            const badgesDiv = document.createElement('div');

            // Category badge
            const categoryBadge = document.createElement('span');
            categoryBadge.textContent = stage.level.meta.category;
            categoryBadge.className = 'badge me-1';
            if (stage.level.meta.category === '轻量趣味') {
                categoryBadge.classList.add('bg-success');
            } else if (stage.level.meta.category === '长线游玩') {
                categoryBadge.classList.add('bg-warning');
            } else {
                categoryBadge.classList.add('bg-secondary');
            }
            badgesDiv.appendChild(categoryBadge);

            // Type badge
            const typeBadge = document.createElement('span');
            typeBadge.textContent = stage.level.meta.type;
            typeBadge.className = 'badge bg-secondary me-1';
            badgesDiv.appendChild(typeBadge);

            // Tags
            if (stage.level.meta.tags && stage.level.meta.tags.length > 0) {
                stage.level.meta.tags.forEach(tag => {
                    const badge = document.createElement('span');
                    badge.textContent = tag;
                    badge.className = 'badge bg-primary me-1';
                    badgesDiv.appendChild(badge);
                });
            }

            const specialTags = extractSpecialTag(stage, activities);
            specialTags.forEach(tag => {
                const specialTag = document.createElement('span');
                specialTag.textContent = tag.label;
                specialTag.className = `badge me-1 ${tag.awarded ? 'bg-danger' : 'bg-accent'}`;
                badgesDiv.appendChild(specialTag);
            });

            nameCell.appendChild(badgesDiv);
            row.appendChild(nameCell);

            // Popularity column (right-aligned)
            const popularityCell = document.createElement('td');
            popularityCell.className = 'text-end';
            
            const popularityBadge = document.createElement('span');
            popularityBadge.textContent = stage.level.meta.hotScore;
            const popClass = getPopularityBadgeClass(stage.level.meta.hotScore);
            popularityBadge.className = `badge ${popClass}`;
            popularityCell.appendChild(popularityBadge);
            row.appendChild(popularityCell);

            // Rating column (left-aligned)
            const ratingCell = document.createElement('td');
            ratingCell.className = 'text-start';
            
            const ratingBadge = document.createElement('span');
            ratingBadge.textContent = stage.level.meta.goodRate + ` (${stage.level.meta.comments})`;
            const rateClass = getRatingBadgeClass(stage.level.meta.goodRate);
            ratingBadge.className = `badge ${rateClass}`;
            ratingCell.appendChild(ratingBadge);
            row.appendChild(ratingCell);

            // Players column
            const playersCell = document.createElement('td');
            
            const playersBadge = document.createElement('span');
            playersBadge.textContent = `${stage.level.meta.players.str}人`;
            let playerBadgeClass;
            if (stage.level.meta.players.str.startsWith('1')) {
                playerBadgeClass = stage.level.meta.players.str.startsWith('1-') ? 'bg-info' : 'bg-success';
            } else {
                playerBadgeClass = 'bg-warning';
            }
            playersBadge.className = `badge ${playerBadgeClass}`;
            playersCell.appendChild(playersBadge);

            row.appendChild(playersCell);

            tbody.appendChild(row);

            Array.from(row.cells).forEach(cell => {
                cell.classList.add('py-3', 'px-2', 'bg-transparent');
            });

            // Apply colored border to removed rows
            if (isRemovedConfirmed) {
                Array.from(row.cells).forEach((cell, cellIndex) => {
                    cell.classList.add('border-top', 'border-bottom', 'border-2', 'border-danger');
                    cell.classList.add(cellIndex === 0 ? 'border-start' : 'border-start-0');
                    cell.classList.add(cellIndex === row.cells.length - 1 ? 'border-end' : 'border-end-0');
                });
            } else if (isRemovedTimeout) {
                Array.from(row.cells).forEach((cell, cellIndex) => {
                    cell.classList.add('border-top', 'border-bottom', 'border-2', 'border-warning');
                    cell.classList.add(cellIndex === 0 ? 'border-start' : 'border-start-0');
                    cell.classList.add(cellIndex === row.cells.length - 1 ? 'border-end' : 'border-end-0');
                });
            }
        });
        table.appendChild(tbody);

        container.appendChild(table);

        // Footer info section
        const footerInfo = document.createElement('div');
        footerInfo.className = 'text-center mt-4 text-secondary';
        footerInfo.style.fontSize = '12px';

        const footerText = document.createElement('span');
        footerText.textContent = 'Generated by ';
        footerInfo.appendChild(footerText);

        const repoLink = document.createElement('span');
        repoLink.textContent = 'kj415j45/octavia';
        repoLink.className = 'text-primary fw-bold';
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
            logging: false,
            ignoreElements: element => document.body.contains(element)
                && !container.contains(element)
                && !element.contains(container)
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
