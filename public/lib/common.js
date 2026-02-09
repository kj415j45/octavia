// Common utilities for Octavia

const baseUrl = "";
let regionMap = {};
let $Stages = [];

// Region map utilities
async function getRegionMap() {
    const response = await fetch(`${baseUrl}/data/regions.json`);
    const regions = await response.json();
    for (const [id, info] of Object.entries(regions)) {
        regionMap[id] = info;
    }
}

async function populateRegionDropdown(currentRegion = 'cn_gf01') {
    await getRegionMap();
    const select = document.getElementById('regionSelect');
    if (!select) return;
    
    select.innerHTML = '';

    for (const [id, data] of Object.entries(regionMap)) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = data.name;
        select.appendChild(option);
    }

    const regionFromUrl = new URLSearchParams(window.location.search).get('region');
    if (regionFromUrl && regionMap[regionFromUrl]) {
        select.value = regionFromUrl;
        return regionFromUrl;
    } else {
        select.value = currentRegion;
        return currentRegion;
    }
}

// API utilities
async function getStageInfo(region, id) {
    const response = await fetch(`${baseUrl}/api/stage?region=${region}&id=${id}`);
    return await response.json();
}

async function getAuthorInfo(uid) {
    const response = await fetch(`${baseUrl}/api/author?id=${uid}`);
    return await response.json();
}

// Stage management
function pushStage(stage) {
    if (!$Stages.find(s => s.level.id === stage.level.id)) {
        $Stages.push(stage);
    }
}

// Card creation
function makeStageCard(stage, region, options = {}) {
    pushStage(stage);
    const level = stage.level;
    const meta = level.meta;
    const author = stage.author;
    
    const showRegion = options.showRegion || false;
    const linkToPlatform = options.linkToPlatform || false;
    const stageEndpointBase = regionMap[region]?.stage || 'https://act.miyoushe.com/ys/ugc_community/mx/#/pages/level-detail/index';
    const authorEndpointBase = regionMap[region]?.author || 'https://www.miyoushe.com/ys/accountCenter';

    // Create card container
    const card = document.createElement('div');
    card.className = 'card h-100 mx-1';

    // Add preview image with click-to-fullscreen functionality
    const previewContainer = document.createElement('div');
    previewContainer.className = 'position-relative';

    const img = document.createElement('img');
    img.src = meta.cover.images[0];
    img.className = 'card-img-top';
    img.alt = meta.name;
    img.style.cursor = 'pointer';

    img.addEventListener('click', () => {
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
        modal.style.cursor = 'pointer';

        const modalContent = document.createElement('div');
        modalContent.style.position = 'relative';
        modalContent.style.maxWidth = '90vw';
        modalContent.style.maxHeight = '90vh';

        const fullImg = document.createElement('img');
        fullImg.className = 'img-fluid';
        fullImg.style.maxWidth = '100%';
        fullImg.style.maxHeight = '90vh';
        fullImg.style.objectFit = 'contain';

        const images = meta.cover.images;
        let currentIndex = 0;
        fullImg.src = images[currentIndex];

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.className = 'btn btn-danger position-absolute';
        closeBtn.style.top = '10px';
        closeBtn.style.right = '10px';
        closeBtn.style.zIndex = '10000';

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.body.removeChild(modal);
        });

        if (images.length > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.textContent = '‹';
            prevBtn.className = 'btn btn-light position-absolute';
            prevBtn.style.left = '10px';
            prevBtn.style.top = '50%';
            prevBtn.style.transform = 'translateY(-50%)';
            prevBtn.style.fontSize = '2rem';
            prevBtn.style.zIndex = '10000';

            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentIndex = (currentIndex - 1 + images.length) % images.length;
                fullImg.src = images[currentIndex];
            });

            const nextBtn = document.createElement('button');
            nextBtn.textContent = '›';
            nextBtn.className = 'btn btn-light position-absolute';
            nextBtn.style.right = '10px';
            nextBtn.style.top = '50%';
            nextBtn.style.transform = 'translateY(-50%)';
            nextBtn.style.fontSize = '2rem';
            nextBtn.style.zIndex = '10000';

            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentIndex = (currentIndex + 1) % images.length;
                fullImg.src = images[currentIndex];
            });

            modalContent.appendChild(prevBtn);
            modalContent.appendChild(nextBtn);
        }

        modalContent.appendChild(fullImg);
        modalContent.appendChild(closeBtn);
        modal.appendChild(modalContent);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        document.body.appendChild(modal);

        const lazyImages = modal.querySelectorAll('img');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    observer.unobserve(img);
                }
            });
        });
        lazyImages.forEach(img => observer.observe(img));
    });

    previewContainer.appendChild(img);
    card.appendChild(previewContainer);

    // Create card body
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body d-flex flex-column';

    // Add name and hot score/good rate
    const titleRow = document.createElement('div');
    titleRow.className = 'd-flex justify-content-between align-items-center';

    const name = document.createElement('h5');
    name.className = 'card-title';
    name.textContent = meta.name;
    titleRow.appendChild(name);

    const stats = document.createElement('small');
    stats.className = 'text-muted';
    stats.textContent = `${meta.hotScore} | ${meta.goodRate}`;
    titleRow.appendChild(stats);

    cardBody.appendChild(titleRow);

    const textContainer = document.createElement('ul');
    textContainer.className = 'list-group';

    // Add intro
    const intro = document.createElement('li');
    intro.className = 'list-group-item';
    intro.innerHTML = meta.intro.replace(/\n/g, '<br>');
    intro.style.height = '5em';
    intro.style.overflowY = 'auto';
    textContainer.appendChild(intro);

    // Add description
    const description = document.createElement('li');
    description.className = 'list-group-item';
    description.innerHTML = meta.description.replace(/\n/g, '<br>');
    description.style.height = '7em';
    description.style.overflowY = 'auto';
    textContainer.appendChild(description);

    cardBody.appendChild(textContainer);

    // Add tags as badges
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'd-flex justify-content-between my-2 row';

    const leftTags = document.createElement('div');
    leftTags.className = 'col-6';
    const playerNumTag = document.createElement('span');
    playerNumTag.className = 'badge me-1';
    if (meta.players.str.startsWith('1')) {
        if (meta.players.str.startsWith('1-')) {
            playerNumTag.classList.add('bg-info');
        } else {
            playerNumTag.classList.add('bg-success');
        }
    } else {
        playerNumTag.classList.add('bg-warning');
    }
    playerNumTag.textContent = `[${meta.players.min}, ${meta.players.max}] ${meta.players.str}人`;
    const typeBadge = document.createElement('span');
    typeBadge.className = 'badge bg-secondary me-1';
    typeBadge.textContent = meta.type;
    leftTags.appendChild(typeBadge);
    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'badge me-1';
    if (meta.category == '轻量趣味') {
        categoryBadge.classList.add('bg-success');
    } else if (meta.category == '长线游玩') {
        categoryBadge.classList.add('bg-warning');
    } else {
        categoryBadge.classList.add('bg-secondary');
    }
    categoryBadge.textContent = meta.category;
    leftTags.appendChild(categoryBadge);

    leftTags.appendChild(document.createElement('br'));
    leftTags.appendChild(playerNumTag);

    const rightTags = document.createElement('div');
    rightTags.className = 'col-6 text-end';
    meta.tags.forEach(tag => {
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary me-1';
        badge.textContent = tag;
        rightTags.appendChild(badge);
    });

    tagsContainer.appendChild(leftTags);
    tagsContainer.appendChild(rightTags);
    cardBody.appendChild(tagsContainer);

    // Add author and level ID section
    const footer = document.createElement('div');
    footer.className = 'card-footer mt-auto d-flex justify-content-between align-items-center';

    // Author info
    const authorInfo = document.createElement('div');
    authorInfo.className = 'd-flex align-items-center';

    const mysUid = author.mys?.aid ? `m${author.mys.aid}` : null;
    const hylUid = author.hyl?.aid ? `h${author.hyl.aid}` : null;
    const authorUid = author.mys?.aid || author.hyl?.aid || "0";
    const authorLinkHref = authorUid !== "0" ? (linkToPlatform ? `${authorEndpointBase}?id=${authorUid}` : `/author/${mysUid ?? hylUid ?? authorUid}`) : '#';

    const authorLink = document.createElement('a');
    authorLink.href = authorLinkHref;
    authorLink.className = 'd-flex align-items-center text-decoration-none';
    if (authorUid == "0") {
        authorLink.style.pointerEvents = 'none';
        authorLink.style.cursor = 'default';
    }

    // Create avatar container to hold avatar and pendant
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'position-relative me-2';
    avatarContainer.style.width = '40px';
    avatarContainer.style.height = '40px';

    const avatar = document.createElement('img');
    const fallbackAvatar = "https://bbs-static.miyoushe.com/upload/op_manual_upload/ugc_community/1769653604473developer_default_avatar.png"
    avatar.src = author.game.avatar ?? author.mys?.avatar ?? author.hyl?.avatar ?? fallbackAvatar;
    avatar.alt = author.game.name ?? author.mys?.name ?? author.hyl?.name ?? "";
    avatar.className = 'rounded-circle';
    avatar.style.width = '40px';
    avatar.style.height = '40px';

    avatarContainer.appendChild(avatar);

    // Add pendant (avatar frame) if available
    if (author.hyl && author.hyl.pendant) {
        const pendant = document.createElement('img');
        pendant.src = author.hyl.pendant;
        pendant.className = 'position-absolute top-0 start-0';
        pendant.style.width = '40px';
        pendant.style.height = '40px';
        pendant.style.pointerEvents = 'none';
        avatarContainer.appendChild(pendant);
    }

    const authorName = document.createElement('span');
    authorName.textContent = author.game.name ?? author.mys?.name ?? author.hyl?.name ?? "";

    authorLink.appendChild(avatarContainer);
    authorLink.appendChild(authorName);

    authorInfo.appendChild(authorLink);

    // Level ID and copy button
    const levelInfo = document.createElement('div');
    levelInfo.className = 'd-flex align-items-center';

    const levelId = document.createElement('a');
    levelId.className = 'me-2';
    levelId.href = `${stageEndpointBase}?id=${level.id}&region=${region}`;
    levelId.target = '_blank';
    levelId.rel = 'noopener';
    levelId.textContent = `${level.id}`;

    const copyButton = document.createElement('button');
    copyButton.className = 'btn btn-sm btn-outline-secondary';
    copyButton.textContent = '复制';
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(level.id).then(() => {
            copyButton.textContent = '已复制';
            copyButton.classList.remove('btn-outline-secondary');
            copyButton.classList.add('btn-success');
            setTimeout(() => {
                copyButton.textContent = '复制';
                copyButton.classList.remove('btn-success');
                copyButton.classList.add('btn-outline-secondary');
            }, 2000);
        });
    });

    levelInfo.appendChild(levelId);
    levelInfo.appendChild(copyButton);

    footer.appendChild(authorInfo);
    footer.appendChild(levelInfo);
    cardBody.appendChild(footer);

    card.appendChild(cardBody);

    // Add region badge at the bottom if needed
    if (showRegion) {
        const regionBadge = document.createElement('div');
        regionBadge.className = 'card-footer bg-info text-white text-center py-1';
        regionBadge.style.fontSize = '0.875rem';
        regionBadge.textContent = regionMap[region]?.name || region;
        card.appendChild(regionBadge);
    }

    return card;
}

// Export for debugging
window.$Stages = $Stages;
