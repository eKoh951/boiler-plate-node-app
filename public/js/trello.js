// Global Stuff
const root = document.querySelector('#root');
const boardsUrl = '/members/me/boards'; 
let members = [];

// Boards stuff
const getMyBoards = async () => {
    const options = {
        fields: 'name'
    };
    
    const myBoards = await Trello.get(
        boardsUrl,
        options,
        onBoardsLoadSuccess,
        onBoardsLoadFailure
    );

    renderBoards(myBoards);
};

// Callbacks
const onBoardsLoadSuccess = () => {
    console.log('Boards loaded succesfully');
}

const onBoardsLoadFailure = () => {
    console.error('Boards could not be loaded');
}

// Events listeners
const onBoardClick = (e) => {
    e.preventDefault();
    const board = JSON.parse(e.target.dataset.boardData);
    fetchBoardData(board);
    console.log('board clicked');
};

// Boards rendering
const renderBoards = (boards) => {
    // Loop through all the boards and generate a list of links to access the boards
    boards.forEach(board => {
        // Create HTML elements
        const newBoardLink = document.createElement('a');
        const newLine = document.createElement('br');
        
        // Define element properties
        newBoardLink.href = window.location.href;
        newBoardLink.value = board.id;
        newBoardLink.id = 'board-' + board.id;
        newBoardLink.innerHTML = board.name;
        newBoardLink.dataset.boardData = JSON.stringify(board);

        // Listen to onClick event
        newBoardLink.addEventListener('click', onBoardClick);

        // console.log({newBoardLink});
        
        // Append children elements to page
        root.appendChild(newBoardLink);
        root.appendChild(newLine);
    });
};

// Fetch board data
const fetchBoardData = async (board) => {
    console.log('fetchBoardData');

    const options = {
        fields: 'name'
    };
    
    const currentBoard = await Trello.rest(
        'GET',
        `/boards/${board.id}/?members=all&fields=name`,
        onBoardsLoadSuccess,
        onBoardsLoadFailure
    );

    // Save members to global variable
    members = currentBoard.members;
        
    let boardLists = await Trello.rest(
        'GET',
        `/boards/${board.id}/lists/?fields=name`,
        onBoardsLoadSuccess,
        onBoardsLoadFailure
    );
    
    // Filter lists
    // boardLists = boardLists.filter(list => list.name.includes('Doing') || list.name.includes('Backlog'));
    
    const cardFields = `idBoard,idChecklists,idLabels,idList,idMembers,idMembersVoted,name,desc,labels`;

    let boardCards = await Trello.rest(
        'GET',
        `/boards/${board.id}/cards/?customFieldItems=true&fields=${cardFields}`,
        onBoardsLoadSuccess,
        onBoardsLoadFailure
    );

    // Filter the cards that are not within 'backlog' and 'doing'
    // boardCards = boardCards.filter(card => card.idList !== boardLists[0].id || card.idList !== boardLists[0].id);

    console.log(currentBoard, boardLists, boardCards);
    renderGeneralTable(currentBoard, boardCards);
};

const getCustomField = async (idCustomField) => {
    const customField = await Trello.rest(
        'GET',
        `customFields/${idCustomField}`,
        () => console.log('Custom Field successfully retrieved'),
        () => console.error(`Could not retrieve custom field with id: ${idCustomField}`)
    );
    return customField;
};

// Render general table
const renderGeneralTable = async (board, cards) => {
    console.log('renderGeneralTable');
    emptyRootElement();
    
    // Create elements
    const title = document.createElement('h1');
    title.innerHTML = 'General Table for ' + board.name;

    // Append elements to root
    root.appendChild(title);

    // This is for the 'unassigned' member
    members[members.length] = {};

    // Array of customFields
    let myCustomFields = [];

    // Iterate over all the cards and output an array of member hours
    cards.forEach((card) => {
        // If the card has not been assigned it will appear on 'unassigned' member
        // it will be the last 'member'
        const memberId = card.idMembers[0] ?? 'unassigned';
        let memberIndex = members.findIndex(member => member.id === memberId);
        if (memberIndex === -1) memberIndex = members.length - 1;

        // Push into the member object, an array of all the customFields
        // Iterate over all custom fields
        if (card.customFieldItems.length > 0) {
            let customFieldArrayFlag = false; // Flag to only create the
            card.customFieldItems.forEach(customField => {
                const { idCustomField, value } = customField;
                
                // To the members array, indexing by number, then create or access a new property
                // with the idCustomField and insert the value
                
                // Sum current value with the last value
                const sum = (value?.number * 1) + (members[memberIndex][idCustomField] ?? 0);

                // Update
                members[memberIndex][idCustomField] = parseFloat(sum).toFixed(2) * 1;

                // console.log('customfield', customField.value.number * 1)
                // console.log('sum ', sum);

                // Create a customField object
                const myCustomField = {
                    idCustomField
                };

                // Store into the array of custom fields if it is not there
                const isInArray = myCustomFields.find(myCustomField => myCustomField.idCustomField === idCustomField);
                if (isInArray === undefined ) myCustomFields.push(myCustomField);
            });
        }
    });

    // For each custom field, we need their name, this returns an array of promises
    myCustomFields = myCustomFields.map(({ idCustomField }) => {
        return getCustomField(idCustomField);
    });

    // Since we have an array of promises, we need to await for them
    myCustomFields = await Promise.all(myCustomFields);

    // Create table
    createTable(board, 'general', myCustomFields);
};

const createTable = (board = null, type = 'general', myCustomFields = []) => {
    console.log('createTable');

    // Create static table elements
    const $thead = document.createElement('thead');
    const $tbody = document.createElement('tbody');
    let $table = document.createElement('table');

    // Append to table
    $table.appendChild($thead);
    $table.appendChild($tbody);

    // Create dynamic table elements
    // Table Head elements
    switch(type) {
        case 'general':
            console.log(type + ' table');
            
            // Create head elements
            let headers = ['Member'];
            myCustomFields.forEach(customField => {
                headers.push(customField.name);
            });
            // const headers = ['Member', 'Estimated hours', 'Real hours'];
            for (const header of headers) {
                const $th = document.createElement('th');
                $th.innerHTML = header;
                $thead.appendChild($th);
            };
            
            // Create body elements
            board.members.forEach(member => {
                // create tr
                const $tr = document.createElement('tr');
    
                // create th
                const $th = document.createElement('th');
                $th.innerHTML = member.fullName ?? member.username;
    
                // attact th and tds to tr
                $tr.append($th);
                
                // create tds
                myCustomFields.forEach(customField => {
                    console.log({members, customField})
                    const $td = document.createElement('td');
                    const customFieldValue = member[customField.id] ?? 0;
                    $td.innerHTML = customFieldValue;
                    $tr.append($td);
                });
    
                // attach tr to tbody
                $tbody.append($tr);
            });    

            // attach tbody to table
            $table.append($tbody);

            // const $memberName = document.createElement('th');
            // $memberName.value = 'erick';
            // $tr.appendChild($memberName);
            
            break;

        default:
            break;
            
    }
    
    root.append($table);
    console.log($table);

};

// Utils functions
const emptyRootElement = () => {
    root.innerHTML = '';
}

// Cards stuff
const creationSuccess = (data) => {
  console.log('Card created successfully.');
  console.log(JSON.stringify(data, null, 2));
};


// Authentication stuff
const authenticationSuccess = () => {
    console.log('Successful authentication');
    getMyBoards();
};
  
const authenticationFailure = () => {
    console.log('Failed authentication');
};

window.Trello.authorize({
    type: 'popup',
    name: 'Getting Started Application',
    scope: {
      read: 'true',
      write: 'true' },
    expiration: 'never',
    success: authenticationSuccess,
    error: authenticationFailure
});