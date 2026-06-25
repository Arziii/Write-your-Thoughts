## **API_DESIGN.md** 

## **Write Your Thoughts - API Design** 

## **Philosophy** 

UI should never communicate directly with providers. 

Everything goes through service layers. 

## **Architecture** 

```
UI
↓
Services
↓
Provider Layer
↓
External Services
```

## **AI Service** 

Responsibilities: 

- Grammar polish 

- Rewrite 

- Brainstorming 

- Explain edits 

Supported providers: 

- OpenAI 

- Gemini 

- Claude 

1 

## **Memory Service** 

Responsibilities: 

- Store memory 

- Retrieve memory 

- Update memory 

- Lock memory 

## **Book Service** 

Responsibilities: 

- Create book 

- Update book 

- Delete book 

## **Chapter Service** 

Responsibilities: 

- Create chapter 

- Autosave 

- Version control 

## **Search Service** 

Responsibilities: 

- Global search 

- Character search 

- Note search 

## **Sync Service** 

Responsibilities: 

- Queue operations 

- Synchronization 

- Conflict resolution 

2 

## **Future Services** 

- Collaboration Service 

- Plugin Service 

- Comment Service 

- Template Service 

3 

